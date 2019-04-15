import { exec } from "child_process";
import axios from "axios";
import express from "express";
import { type } from "os";

/**
 * Описывает структуру которую мы будет возвращать на запрос get_wall.
 * Обработчик этого запроса создается функцией [[createApiPoint_get_wall]]
 */
interface Wall_get_result {
  status: boolean;
  result: WallCache;
}

/**
 * Описывает упрощенную структуру которуая соотвествует записям на стене vk_mzk
 */
interface WallCache {
  response: {
    items: WallCacheItem[];
    count: number;
  };
}

/**
 *  Описывает структуру поста, по упрощенной схеме.
 *  На текущий момент нас не слишком интересует содержимое т,к
 *  мы просто отдаем эти данные клиенту
 *
 *  Поле текст пригодится для кеширования синтеза речи.
 */
interface WallCacheItem {
  text: string;
}

/**
 * Описывает обьект содержащий всю логику обработки запросов и кеширования;
 */
class Api {
  /**
   * содержит access token.
   * он нужен для работы с api vk
   */
  private token: string | undefined;
  /**
   * хранит данные которые мы будет возвращать на запрос get_wall
   * это является кэшем стены vk (последние 300 постов)
   */
  private wallCache: WallCache;

  /**
   * Инициализирует express server на 8080 порту.
   * Создает конечные точки для обработки http запросов используя функции:
   *
   * [[createApiPoint_get_wall]],
   * [[createApiPoint_wall_get_comments]],
   * [[createApiPoint_get_links]],
   * [[createApiPoint_get_photos]]
   */
  constructor() {
    let app = express();
    app.use(express.json());

    this.createApiPoint_get_wall(app);
    this.createApiPoint_wall_get_comments(app);
    this.createApiPoint_get_links(app);
    this.createApiPoint_get_photos(app);

    this.token = undefined;
    this.wallCache = {
      response: {
        items: [],
        count: 0
      }
    };

    app.listen(8080);
    console.log("mzk_love_api started on port 8080");
  }

  /**
   * Точка входа в риложения;
   * Получает начальный [[token]];
   * Получает начальный [[wallCache]];
   * Запускает сервис обновления [[token]];
   * Запускает сервис обновления [[wallCache]];
   */
  public main() {
    this.tokenSerivse(() => {
      this.wallCacheServise();
    });
    this.tokenServiseStart();
    this.wallCacheServiseStart();
  }

  /**
   * Создает точку обрабатывающую http запрос get_wall
   *  запрос на данную точку апи просто возвращает [[Wall_get_result]];
   */
  private createApiPoint_get_wall(app: express.Express) {
    app.get("/mzk_love_api/get_wall", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      let status;
      if (this.wallCache) {
        status = true;
      } else {
        status = false;
      }
      let wall_get_result: Wall_get_result = { status, result: this.wallCache };
      res.send(JSON.stringify(wall_get_result));
    });
  }

  /**
   * Создает точку обрабатывающую http запрос wall_get_comments
   * запрос возвращает комментарии к посту;
   * функция делает магию связанную с получение фотографий пользователей,
   * так что это  не соответсвует стандартной структуре api vk)
   * в параметрах get запроса должны быть переданы owner_id и post_id
   */
  private createApiPoint_wall_get_comments(app: express.Express) {
    app.get("/mzk_love_api/wall_get_comments", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      axios
        .get(
          `https://api.vk.com/method/wall.getComments?v=5.92&` +
            `access_token=${this.token}&` +
            `owner_id=${req.query.owner_id}&` +
            `post_id=${req.query.post_id}&` +
            `fields=thread&` +
            `count=100&` +
            `extended=1&` +
            `thread_items_count=10`
        )
        .then((result: any) => {
          let from_idString = this.getFrom_idStringFromComments(
            result.data.response.items
          );
          return new Promise(resolve => {
            this.usersGet(from_idString)
              .then((users: any) => {
                result.data.response.users = users.data.response.reduce(
                  (acum: any, item: any) => {
                    acum[item.id] = item;
                    return acum;
                  },
                  {}
                );
                resolve(result.data);
              })
              .catch((e: any) => {
                console.log(e);
              });
          });
        })
        .then((result: any) => {
          res.send(JSON.stringify(result));
        })
        .catch((e: any) => {
          console.log(e);
        });
    });
  }

  /**
   * Создает точку обрабатывающую http запрос get_links;
   * Точка api возвращает прямую ссылку для проигрывания видео;
   * В параметре get запрос должен быть передан url ссылки  на пеер vk.
   */
  private createApiPoint_get_links(app: express.Express) {
    app.get("/apps/vk/get_links.php", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      axios
        .get("http://212.77.128.203/apps/vk/get_links.php?url=" + req.query.url)
        .then((result: any) => {
          res.send(JSON.stringify(result.data));
        })
        .catch((e: any) => {
          console.log(e);
        });
    });
  }

  private createApiPoint_get_photos(app: express.Express) {
    app.get("/mzk_love_api/get_photos", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      axios
        .get(
          `https://api.vk.com/method/photos.get?v=5.92&` +
            `access_token=${this.token}&` +
            `album_id=${req.query.album_id}&` +
            `owner_id=${req.query.owner_id}`
        )
        .then((result: any) => {
          res.send(JSON.stringify(result.data));
        })
        .catch((e: any) => {
          console.log(e);
        });
    });
  }

  /**
   * Метод получает access token для работы с api vk;
   * access token сохраняется в [[token]]
   * По завершенни работы вызывает функцию cb если она существует;
   */
  private tokenSerivse(cb?: Function) {
    exec(
      "./getToken/phantomjs  ./getToken/getToken.js",
      (error: any, stdout: any, stderr: any) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        this.token = stdout.trim();
        console.log(this.token + " ");
        if (typeof cb === "function") {
          cb();
        }
      }
    );
  }

  /**
   * Вызывает [[tokenSerivse]] раз в 4 часа
   */

  private tokenServiseStart() {
    setInterval(() => {
      this.tokenSerivse();
    }, 14400000); //4 часа
  }

  /**
   * получает последние 300 записей vk_mzk и сохраняет их в [[wallCache]]
   */
  private wallCacheServise() {
    axios
      .get(this.getWallUrl())
      .then((response: any) => {
        this.wallCache = response.data;
        return new Promise(resolve => {
          resolve(axios);
        });
      })
      .then((axios: any) => {
        return axios.get(this.getWallUrl(100));
      })
      .then((response: any) => {
        this.wallCache.response.items = this.wallCache.response.items.concat(
          response.data.response.items
        );
        return new Promise(resolve => {
          resolve(axios);
        });
      })
      .then((axios: any) => {
        return axios.get(this.getWallUrl(200));
      })
      .then((response: any) => {
        this.wallCache.response.items = this.wallCache.response.items.concat(
          response.data.response.items
        );
        return new Promise(resolve => {
          resolve(true);
        });
      })
      .then(() => {
        this.textToSpeechGoCache();
        return new Promise(resolve => {
          resolve(true);
        });
      })
      .catch((e: Error) => {
        console.log(e);
      });
  }

  /**
   * вызывает [[wallCacheServise]] раз в 30 минут
   */
  private wallCacheServiseStart() {
    setInterval(() => {
      this.wallCacheServise();
    }, 1800000); // 30 мин
  }

  /**
   * вспомогательная функция для [[createApiPoint_wall_get_comments]]
   * @param from_idString список id пользователей через запятую
   */
  private usersGet(from_idString: string) {
    return new Promise(resolve => {
      axios
        .get(
          `https://api.vk.com/method/users.get?v=5.92&` +
            `access_token=${this.token}&` +
            `user_ids=${from_idString}&` +
            `fields=photo_200`
        )
        .then((result: any) => {
          resolve(result);
          return new Promise(resolve => {
            resolve(true);
          });
        })
        .catch((e: Error) => {
          console.log(e);
        });
    });
  }

  /**
   * вспомогательная функция для [[createApiPoint_wall_get_comments]]
   */
  private getFrom_idStringFromComments(commentsArr: any[]) {
    function reducer(acum: any, item: any) {
      acum[item.from_id] = true;
      getFrom_idArrFromThread(acum, item.thread.items);
      return acum;
    }
    function getFrom_idArrFromThread(acum: any, threadItems: any[]) {
      threadItems.forEach(function(item) {
        acum[item.from_id] = true;
      });
    }
    let idStore = commentsArr.reduce(reducer, {});
    return Object.keys(idStore).join(",");
  }

  /**
   * Отпраляет просьбу сервесу синтеза речи,
   * закешировать текст находящийся в постах [[wallCache]]
   */
  private textToSpeechGoCache() {
    let items: WallCacheItem[] = JSON.parse(
      JSON.stringify(this.wallCache.response.items)
    );
    recurse(items);

    function recurse(items: WallCacheItem[]) {
      let item = items.shift();
      if (typeof item === "undefined") {
        return;
      }
      if (item.text) {
        axios
          .post("http://212.77.128.203:8081/getSpeech", {
            text: specialSpeechTextProccessing(item.text)
          })
          .then(() => {
            recurse(items);
          })
          .catch((e: Error) => {
            console.log(e);
            return;
          });
      } else {
        recurse(items);
        return;
      }
    }
  }

  /**
   * вспомогательная функция для [[wallCacheServise]]
   */
  private getWallUrl(offset?: number | string) {
    if (typeof offset === "undefined") {
      offset = "";
    } else {
      offset = "&offset=" + offset;
    }
    return (
      `https://api.vk.com/method/wall.get?v=5.52&access_token=${
        this.token
      }&owner_id=-11504106&count=100` + offset
    );
  }
}

function specialSpeechTextProccessing(string: string) {
  return string
    .replace(/#/g, " хештег ")
    .replace(/_/g, " ")
    .replace(/(https|http):\/\/.*($|\s)/g, "")
    .replace(/\[(id|club).*]/g, function(s) {
      return s.replace(/\[|\]|\||(id\d*)|(club\d*)/g, "");
    });
}

let api = new Api();
api.main();
