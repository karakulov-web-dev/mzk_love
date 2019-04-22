"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var child_process_1 = require("child_process");
var axios_1 = __importDefault(require("axios"));
var express_1 = __importDefault(require("express"));
/**
 * Описывает обьект содержащий всю логику обработки запросов и кеширования;
 */
var Api = /** @class */ (function () {
    /**
     * Инициализирует express server на 8080 порту.
     * Создает конечные точки для обработки http запросов используя функции:
     *
     * [[createApiPoint_get_wall]],
     * [[createApiPoint_wall_get_comments]],
     * [[createApiPoint_get_links]],
     * [[createApiPoint_get_photos]]
     */
    function Api() {
        var app = express_1["default"]();
        app.use(express_1["default"].json());
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
    Api.prototype.main = function () {
        var _this = this;
        this.tokenSerivse(function () {
            _this.wallCacheServise();
        });
        this.tokenServiseStart();
        this.wallCacheServiseStart();
    };
    /**
     * Создает точку обрабатывающую http запрос get_wall
     *  запрос на данную точку апи просто возвращает [[Wall_get_result]];
     */
    Api.prototype.createApiPoint_get_wall = function (app) {
        var _this = this;
        app.get("/mzk_love_api/get_wall", function (req, res) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            var status;
            if (_this.wallCache) {
                status = true;
            }
            else {
                status = false;
            }
            var wall_get_result = { status: status, result: _this.wallCache };
            res.send(JSON.stringify(wall_get_result));
        });
    };
    /**
     * Создает точку обрабатывающую http запрос wall_get_comments
     * запрос возвращает комментарии к посту;
     * функция делает магию связанную с получение фотографий пользователей,
     * так что это  не соответсвует стандартной структуре api vk)
     * в параметрах get запроса должны быть переданы owner_id и post_id
     */
    Api.prototype.createApiPoint_wall_get_comments = function (app) {
        var _this = this;
        app.get("/mzk_love_api/wall_get_comments", function (req, res) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            axios_1["default"]
                .get("https://api.vk.com/method/wall.getComments?v=5.92&" +
                ("access_token=" + _this.token + "&") +
                ("owner_id=" + req.query.owner_id + "&") +
                ("post_id=" + req.query.post_id + "&") +
                "fields=thread&" +
                "count=100&" +
                "extended=1&" +
                "thread_items_count=10")
                .then(function (result) {
                var from_idString = _this.getFrom_idStringFromComments(result.data.response.items);
                return new Promise(function (resolve) {
                    _this.usersGet(from_idString)
                        .then(function (users) {
                        result.data.response.users = users.data.response.reduce(function (acum, item) {
                            acum[item.id] = item;
                            return acum;
                        }, {});
                        resolve(result.data);
                    })["catch"](function (e) {
                        console.log(e);
                    });
                });
            })
                .then(function (result) {
                res.send(JSON.stringify(result));
            })["catch"](function (e) {
                console.log(e);
            });
        });
    };
    /**
     * Создает точку обрабатывающую http запрос get_links;
     * Точка api возвращает прямую ссылку для проигрывания видео;
     * В параметре get запрос должен быть передан url ссылки  на пеер vk.
     */
    Api.prototype.createApiPoint_get_links = function (app) {
        app.get("/apps/vk/get_links.php", function (req, res) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            axios_1["default"]
                .get("http://212.77.128.203/apps/vk/get_links.php?url=" + req.query.url)
                .then(function (result) {
                res.send(JSON.stringify(result.data));
            })["catch"](function (e) {
                console.log(e);
            });
        });
    };
    Api.prototype.createApiPoint_get_photos = function (app) {
        var _this = this;
        app.get("/mzk_love_api/get_photos", function (req, res) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            axios_1["default"]
                .get("https://api.vk.com/method/photos.get?v=5.92&" +
                ("access_token=" + _this.token + "&") +
                ("album_id=" + req.query.album_id + "&") +
                ("owner_id=" + req.query.owner_id))
                .then(function (result) {
                res.send(JSON.stringify(result.data));
            })["catch"](function (e) {
                console.log(e);
            });
        });
    };
    /**
     * Метод получает access token для работы с api vk;
     * access token сохраняется в [[token]]
     * По завершенни работы вызывает функцию cb если она существует;
     */
    Api.prototype.tokenSerivse = function (cb) {
        var _this = this;
        child_process_1.exec("./getToken/phantomjs  ./getToken/getToken.js", function (error, stdout, stderr) {
            if (error) {
                console.error("exec error: " + error);
                return;
            }
            _this.token = stdout.trim();
            console.log(_this.token + " ");
            if (typeof cb === "function") {
                cb();
            }
        });
    };
    /**
     * Вызывает [[tokenSerivse]] раз в 4 часа
     */
    Api.prototype.tokenServiseStart = function () {
        var _this = this;
        setInterval(function () {
            _this.tokenSerivse();
        }, 14400000); //4 часа
    };
    /**
     * получает последние 300 записей vk_mzk и сохраняет их в [[wallCache]]
     */
    Api.prototype.wallCacheServise = function () {
        var _this = this;
        axios_1["default"]
            .get(this.getWallUrl())
            .then(function (response) {
            _this.wallCache = response.data;
            return new Promise(function (resolve) {
                resolve(axios_1["default"]);
            });
        })
            .then(function (axios) {
            return axios.get(_this.getWallUrl(100));
        })
            .then(function (response) {
            _this.wallCache.response.items = _this.wallCache.response.items.concat(response.data.response.items);
            return new Promise(function (resolve) {
                resolve(axios_1["default"]);
            });
        })
            .then(function (axios) {
            return axios.get(_this.getWallUrl(200));
        })
            .then(function (response) {
            _this.wallCache.response.items = _this.wallCache.response.items.concat(response.data.response.items);
            return new Promise(function (resolve) {
                resolve(true);
            });
        })
            .then(function () {
            _this.textToSpeechGoCache();
            return new Promise(function (resolve) {
                resolve(true);
            });
        })["catch"](function (e) {
            console.log(e);
        });
    };
    /**
     * вызывает [[wallCacheServise]] раз в 30 минут
     */
    Api.prototype.wallCacheServiseStart = function () {
        var _this = this;
        setInterval(function () {
            _this.wallCacheServise();
        }, 1800000); // 30 мин
    };
    /**
     * вспомогательная функция для [[createApiPoint_wall_get_comments]]
     * @param from_idString список id пользователей через запятую
     */
    Api.prototype.usersGet = function (from_idString) {
        var _this = this;
        return new Promise(function (resolve) {
            axios_1["default"]
                .get("https://api.vk.com/method/users.get?v=5.92&" +
                ("access_token=" + _this.token + "&") +
                ("user_ids=" + from_idString + "&") +
                "fields=photo_200")
                .then(function (result) {
                resolve(result);
                return new Promise(function (resolve) {
                    resolve(true);
                });
            })["catch"](function (e) {
                console.log(e);
            });
        });
    };
    /**
     * вспомогательная функция для [[createApiPoint_wall_get_comments]]
     */
    Api.prototype.getFrom_idStringFromComments = function (commentsArr) {
        function reducer(acum, item) {
            acum[item.from_id] = true;
            getFrom_idArrFromThread(acum, item.thread.items);
            return acum;
        }
        function getFrom_idArrFromThread(acum, threadItems) {
            threadItems.forEach(function (item) {
                acum[item.from_id] = true;
            });
        }
        var idStore = commentsArr.reduce(reducer, {});
        return Object.keys(idStore).join(",");
    };
    /**
     * Отпраляет просьбу сервесу синтеза речи,
     * закешировать текст находящийся в постах [[wallCache]]
     */
    Api.prototype.textToSpeechGoCache = function () {
        var items = JSON.parse(JSON.stringify(this.wallCache.response.items));
        recurse(items);
        function recurse(items) {
            var item = items.shift();
            if (typeof item === "undefined") {
                return;
            }
            if (item.text) {
                axios_1["default"]
                    .post("http://212.77.128.203:8081/getSpeech", {
                    text: specialSpeechTextProccessing(item.text)
                })
                    .then(function () {
                    recurse(items);
                })["catch"](function (e) {
                    recurse(items);
                    console.log(e);
                    return;
                });
            }
            else {
                recurse(items);
                return;
            }
        }
    };
    /**
     * вспомогательная функция для [[wallCacheServise]]
     */
    Api.prototype.getWallUrl = function (offset) {
        if (typeof offset === "undefined") {
            offset = "";
        }
        else {
            offset = "&offset=" + offset;
        }
        return ("https://api.vk.com/method/wall.get?v=5.52&access_token=" + this.token + "&owner_id=-11504106&count=100" + offset);
    };
    return Api;
}());
function specialSpeechTextProccessing(string) {
    return string
        .replace(/#/g, " хештег ")
        .replace(/_/g, " ")
        .replace(/(https|http):\/\/.*($|\s)/g, "")
        .replace(/\[(id|club).*]/g, function (s) {
        return s.replace(/\[|\]|\||(id\d*)|(club\d*)/g, "");
    });
}
var api = new Api();
api.main();
