const { platformName } = require("./Constants");
const logger = require("./Logger.js").Logger,
  http = require("https"),
  rp = require("request-promise-native"),
  url = require("url");

module.exports = class ST_Client {
  constructor(platform) {
    this.platform = platform;
    this.log = platform.log;
    this.useLocal = platform.local_commands;
    this.hubIp = platform.local_hub_ip;
    this.configItems = platform.getConfigItems();
    let appURL = url.parse(this.configItems.app_url);
    this.urlItems = {
      app_host: appURL.hostname || "graph.api.smartthings.com",
      app_port: appURL.port || 443,
      app_path:
        (appURL.path || "/api/smartapps/installations/") +
        this.configItems.app_id +
        "/"
    };
  }

  updateGlobals(hubIp, useLocal = false) {
    this.platform.log("Updating globals: " + hubIp + ", " + useLocal);
    this.hubIp = hubIp;
    this.useLocal = useLocal === true;
  }

  getDevices() {
    let that = this;
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      rp({
        uri: `${that.configItems.app_url}${that.configItems.app_id}/devices`,
        qs: {
          access_token: that.configItems.access_token
        },
        json: true
      })
        .then(function(body) {
          resolve(body);
        })
        .catch(function(err) {
          that.log.debug("reqPromise Error: ", err.message);
          resolve(undefined);
        });
    });
  }

  getDevice(deviceid) {
    let that = this;
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      rp({
        uri: `${that.configItems.app_url}${that.configItems.app_id}/${deviceid}/query`,
        qs: {
          access_token: that.configItems.access_token
        },
        json: true
      })
        .then(function(body) {
          resolve(body);
        })
        .catch(function(err) {
          that.log.debug("reqPromise Error: ", err.message);
          resolve(undefined);
        });
    });
  }

  getUpdates(callback) {
    this.GET(
      {
        debug: false,
        path: "getUpdates"
      },
      function(data) {
        if (callback) {
          callback(data);
          callback = undefined;
        }
      }
    );
  }

  runCommand(callback, deviceid, command, values) {
    this.platform.log.debug(
      "[" +
        platformName +
        " Plugin Action] Command: " +
        command +
        " | Value: " +
        (values !== undefined ? JSON.stringify(values) : "Nothing") +
        " | DeviceID: (" +
        deviceid +
        ") | local_cmd: " +
        this.useLocal
    );
    let config = {};
    if (this.useLocal === true && this.hubIp !== undefined) {
      config = {
        debug: false,
        uri: "http://" + this.hubIp + ":39500/event",
        body: {
          deviceid: deviceid,
          command: command,
          values: values
        },
        headers: {
          evtSource: "Homebridge_" + platformName,
          evtType: "hkCommand"
        },
        useLocal: true
      };
    } else {
      config = {
        debug: false,
        path: deviceid + "/command/" + command,
        data: values
      };
    }
    this.POST(config, function() {
      if (callback) {
        callback();
        callback = undefined;
      }
    });
  }

  startDirect(callback) {
    let that = this;
    if (this.useLocal === true && this.hubIp !== undefined) {
      this.POST(
        {
          debug: false,
          uri: "http://" + that.hubIp + ":39500/event",
          body: {
            ip: that.configItems.direct_ip,
            port: that.configItems.direct_port
          },
          headers: {
            evtSource: "Homebridge_" + platformName,
            evtType: "enableDirect"
          },
          useLocal: true
        },
        function() {
          if (callback) {
            callback();
            callback = undefined;
          }
        }
      );
    } else {
      this.GET(
        {
          debug: false,
          path:
            "startDirect/" +
            that.configItems.direct_ip +
            "/" +
            that.configItems.direct_port
        },
        function() {
          if (callback) {
            callback();
            callback = undefined;
          }
        }
      );
    }
  }

  getSubscriptionService(callback) {
    this.GET(
      {
        debug: false,
        path: "getSubcriptionService"
      },
      function(data) {
        if (callback) {
          callback(data);
          callback = undefined;
        }
      }
    );
  }

  _http(data, callback) {
    //console.log("Calling " + platformName);
    let options = {
      hostname: this.urlItems.app_host,
      port: this.urlItems.app_port,
      path:
        this.urlItems.app_path +
        data.path +
        "?access_token=" +
        this.configItems.access_token,
      method: data.method,
      headers: {}
    };
    if (data.data) {
      data.data = JSON.stringify(data.data);
      options.headers["Content-Length"] = Buffer.byteLength(data.data);
      options.headers["Content-Type"] = "application/json";
    }
    if (data.debug) {
      logger.log.debug("_http options: ", JSON.stringify(options));
    }
    let str = "";
    let req = http.request(options, function(response) {
      response.on("data", function(chunk) {
        str += chunk;
      });

      response.on("end", function() {
        if (data.debug) {
          logger.log.debug("response in http:", str);
        }
        try {
          str = JSON.parse(str);
        } catch (e) {
          if (data.debug) {
            logger.log.debug(e.stack);
            logger.log.debug("raw message", str);
          }
          str = undefined;
        }
        if (callback) {
          callback(str);
          callback = undefined;
        }
      });
    });
    if (data.data) {
      req.write(data.data);
    }

    req.end();

    req.on("error", function(e) {
      logger.log.debug("error at req: ", e.message);
      if (callback) {
        callback();
        callback = undefined;
      }
    });
  }

  _httpLocalPost(data, callback) {
    let options = {
      method: data.method,
      uri: data.uri,
      headers: data.headers || {},
      body: data.body || {},
      json: true
    };
    rp(options)
      .then(function(body) {
        if (callback) {
          callback(body);
          callback = undefined;
        }
      })
      .catch(function(err) {
        logger.log.debug("reqPromise Error: ", err.message);
        if (callback) {
          callback();
          callback = undefined;
        }
      });
  }

  POST(data, callback) {
    data.method = "POST";
    if (data.useLocal === true) {
      this._httpLocalPost(data, callback);
    } else {
      this._http(data, callback);
    }
  }

  GET(data, callback) {
    data.method = "GET";
    this._http(data, callback);
  }
};
