var { exec } = require("child_process");
import axios from "axios";
import express from "express";

interface WallCache {
  response: {
    items: any[];
    count: number;
  };
}

class Api {
  private token: string | undefined;
  private wallCache: WallCache;

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

  public main() {
    this.tokenSerivse(() => {
      this.wallCacheServise();
    });
    this.tokenServiseStart();
    this.wallCacheServiseStart();
  }

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
      res.send(JSON.stringify({ status, result: this.wallCache }));
    });
  }

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

  private tokenServiseStart() {
    setInterval(() => {
      this.tokenSerivse();
    }, 14400000); //4 часа
  }

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

  private wallCacheServiseStart() {
    setInterval(() => {
      this.wallCacheServise();
    }, 1800000); // 30 мин
  }

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

  private textToSpeechGoCache() {
    this.wallCache.response.items.forEach((item: any) => {
      if (item.text) {
        axios
          .post("http://212.77.128.177:8081/getSpeech", {
            text: item.text
          })
          .then()
          .catch((e: Error) => {
            console.log(e);
          });
      }
    });
  }

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

let api = new Api();
api.main();
