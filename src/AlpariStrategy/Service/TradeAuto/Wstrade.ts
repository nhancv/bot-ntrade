/*
 * MIT License
 *
 * Copyright (c) 2018 Nhan Cao
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
import moment from "moment";
import request from 'request';
import LifeCycle from "../../Utils/LifeCycle";
import {ConfigEnv} from "../../Model/ConfigEnv";
import DefaultOrder from "./Order/DefaultOrder";
import IStrategyRes from "./Order/IStrategyRes";
import IStrategyReq from "./Order/IStrategyReq";
import {TradeUser} from "../../Model/TradeUser";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');

const crypto = require('crypto');
const WebSocketClient = require('websocket').client;
const timeZone = "+0700";
const TAG = '[Wstrade]';

// @nhancv 10/14/19: External strategy token
const STRATEGY_AUTH_TOKEN = process.env.EXTERNAL_STRATEGY_AUTH_TOKEN ? process.env.EXTERNAL_STRATEGY_AUTH_TOKEN : '';
const STRATEGY_HOST = process.env.EXTERNAL_STRATEGY_HOST ? process.env.EXTERNAL_STRATEGY_HOST : 'http://localhost:7777';

/**
 * This class implement trading automatically when Wsprice satisfy condition
 */
export default class Wstrade implements LifeCycle {

  // Ref to config
  config: ConfigEnv;
  tasks: object = {};
  defaultOrder: DefaultOrder;

  notifyOnChatHook: (chatId: string, dataLog: string) => void = () => {
    // ignore
  };
  notifyOnSystemHook: (dataLog: string) => void = () => {
    // ignore
  };
  notifyOnStopBotByMarket: (accountId: string) => void = () => {
    // ignore
  };

  constructor(config: any) {
    this.config = config;
    this.defaultOrder = new DefaultOrder();
  }

  async onCreate() {
  }

  async onStart() {
    try {
      for (let accountId in this.config.tradeUsers) {
        await this.onResume(accountId);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async onStop() {
    try {
      for (let accountId in this.tasks) {
        if (this.tasks.hasOwnProperty(accountId)) {
          await this.onPause(accountId);
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async onDestroy() {
  }

  async onPause(accountId: string) {
    try {
      if (this.tasks.hasOwnProperty(accountId)) {
        this.stopTask(accountId);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async onResume(accountId: string) {
    try {
      if (this.config.tradeUsers.hasOwnProperty(accountId)
        && this.config.tradeUsers[accountId].start === true
        && this.config.tradeUsers[accountId].isRunning === true) {
        await this.stopTask(accountId, false);
        await this.execute(accountId);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Publish message to chat
   * @param cb
   */
  onChatHook(cb: (chatId: string, dataLog: string) => void) {
    this.notifyOnChatHook = cb;
  }

  /**
   * Publish system message to chat
   * @param onSystem
   */
  onSystemHook(onSystem: (dataLog: string) => void) {
    this.notifyOnSystemHook = onSystem;
  }

  /**
   * Stop bot by market
   * @param onStopBotByMarket
   */
  onStopBotByMarket(onStopBotByMarket: (accountId: string) => void) {
    this.notifyOnStopBotByMarket = onStopBotByMarket;
  }

  /**
   * Market error stop task.
   * Ex: balance it not enough, error when order
   * @param accountId
   * @param message
   */
  marketStopTask(accountId: string, message?: string) {
    try {
      this.config.tradeUsers[accountId].isRunning = false;
      let marketMsg = `${TAG} ${accountId} stop by market${message ? ': ' + message : ''}`;
      logger.info(marketMsg);
      this.notifyOnChatHook(this.config.tradeUsers[accountId].chatId, marketMsg);
      this.notifyOnSystemHook(marketMsg);
      this.notifyOnStopBotByMarket(accountId);
      this.stopTask(accountId, false);
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Stop task by account id
   * @param accountId
   * @param notify
   */
  stopTask(accountId: string, notify: boolean = true) {
    try {
      if (this.tasks.hasOwnProperty(accountId) &&
        this.tasks[accountId].client != null) {
        let conn = this.tasks[accountId].client.connection;
        if (conn) {
          conn.close();
          conn.removeAllListeners();
        }
        this.tasks[accountId].client = null;
        if (notify) {
          this.notifyOnSystemHook(`${TAG} ${accountId} stopTask`
          );
        }
        logger.info(
          `${TAG} ${accountId} stopTask`
        );
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   api1:GET https://wstrade.alpari.io/socket.io/?EIO=3&transport=polling
   96:0{"sid":"0DGsMYQJzTuRLKgPAYMO","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":5000}2:40
   api2: POST https://wstrade.alpari.io/socket.io/?EIO=3&transport=polling&sid=0DGsMYQJzTuRLKgPAYMO
   Request payload:
   190:42["send_user",{"uid":"807554","account_id":"T922977","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjUyOTYsImlhdCI6MTU2NzA4MDA1NTUzMn0.69V2908rRZyH3u8Bi2XUBwOz0GXJsjFkXc51i3Ms9ls"}]
   => Response: ok

   Websocket: wss://wstrade.alpari.io/socket.io/?EIO=3&transport=websocket&sid=0DGsMYQJzTuRLKgPAYMO
   send: 2probe
   recv: 3probe
   send: 5
   Keep alive by send interval every 25s:
   42["keep_alive",{"uid":"807554","account_id":"T922977","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjUyOTYsImlhdCI6MTU2NzAwNjY2ODExMn0.kTz7hGKJeq76V83PfJRJFWH1jlzqUn6g1ckKffWajic"}]
   2

   ORDER BUY
   ----
   send: 42["send_order",{"u_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjUyOTYsImlhdCI6MTU2NzA4MDA1NTUzMn0.69V2908rRZyH3u8Bi2XUBwOz0GXJsjFkXc51i3Ms9ls","t":"8f7c9786cb6c7532241a42f0caa6d3b0","account_id":"T922977","pair_id":"BTC-USD","wallet":0,"action":"buy","amount":5}]
   42["OrderResult",{"result":"ok","action":"buy","message":"(BTC-USD) buy success"}]
   42["account_data",{"account_status":1,"account_balance":99760000000,"orders":{"BTC-USD":{"buy_amount":500000000,"sell_amount":0}}}]

   42["TradeResult",{"status":-1,"message":"-5"}]
   42["account_data",{"account_status":1,"account_balance":99760000000,"orders":{}}]

   ORDER SELL
   ----
   send: 42["send_order",{"u_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjUyOTYsImlhdCI6MTU2NzA4MDA1NTUzMn0.69V2908rRZyH3u8Bi2XUBwOz0GXJsjFkXc51i3Ms9ls","t":"e9527f49aa45e50f77a867aea686729b","account_id":"T922977","pair_id":"BTC-USD","wallet":0,"action":"sell","amount":5}]
   42["OrderResult",{"result":"ok","action":"sell","message":"(BTC-USD) sell success"}]
   42["account_data",{"account_status":1,"account_balance":99260000000,"orders":{"BTC-USD":{"buy_amount":0,"sell_amount":500000000}}}]

   42["TradeResult",{"status":-1,"message":"-5"}]
   42["account_data",{"account_status":1,"account_balance":99260000000,"orders":{}}]

   PING
   send: 42["keep_alive",{"uid":"807554","account_id":"T922977","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjUyOTYsImlhdCI6MTU2NzA4MDA1NTUzMn0.69V2908rRZyH3u8Bi2XUBwOz0GXJsjFkXc51i3Ms9ls"}]
   send: 2

   * FLOW to connect websocket wsprice
   1. First call api1 to get sid
   2. Active sid by call api2 with sid from api1
   3. Connect to websocket with sid from api1
   4: Send handshake message '2probe' via websocket. Response for handshake message is '3probe', then handshake will be setup fine
   5: Create schedule ping every 25 seconds

   How to get token_id:
   POST: https://auth.alpari.io/signin
   Body (raw text): {"account_id":"T922977","password":"xxxxxxxx"}
   Res:
   {
      "uid": "928476",
      "account_id": "T938747",
      "token": "xxxx"
     }
   */
  async execute(accountId: string) {
    try {
      const logMsg = `${TAG} ${accountId} execute`;
      logger.info(logMsg);
      this.notifyOnSystemHook(logMsg);

      let sid: string = await this.api1();
      logger.info(
        `${TAG} ${accountId} Sid: ${sid}`
      );
      if (!sid) return;

      await this.api2(sid, accountId);

      this.wstradeConnect(sid, accountId);

    } catch (e) {
      this.tryToReConnect(accountId).then();
      logger.error(e);
      return;
    }
  }

  /**
   * Call api get sid
   */
  api1 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      let api = `https://wstrade.alpari.io/socket.io/?EIO=3&transport=polling`;
      logger.info(`${TAG} GET: ${api}`);

      request(api,
        (error, response, body) => {
          if (error) {
            logger.error(error);
            reject(error);
          } else {
            logger.info(`${TAG} Body: ${body}`);
            try {
              let jsonContent = body.substr(4, body.length - 8);
              let sid = JSON.parse(jsonContent)["sid"];
              resolve(sid);
            } catch (e) {
              logger.error(e);
              reject(e);
            }
          }
        }
      );
    });
  };

  /**
   * Call api to active token with sid
   * @param sid
   * @param accountId
   */
  api2 = (sid: string, accountId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        let api = `https://wstrade.alpari.io/socket.io/?EIO=3&transport=polling&sid=${sid}`;
        logger.info(`${TAG} POST: ${api}`);

        request.post({
          headers: {'content-type': 'application/x-www-form-urlencoded'},
          url: api,
          body: `190:42[\"send_user\",{\"uid\":\"${this.config.tradeUsers[accountId].userId}\",\"account_id\":\"${this.config.tradeUsers[accountId].accountId}\",\"token\":\"${this.config.tradeUsers[accountId].token}\"}]`
        }, (error, response, body) => {
          if (error) {
            logger.error(error);
            reject(error);
          } else {
            logger.info(`${TAG} ${accountId} Body: ${body}`);
            resolve();
          }
        });
      }
    );
  };

  /**
   * This function get token by account trade id and password
   * @param accountId
   * @param password
   */
  tokenRetrieve = (accountId: string, password: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      let api = `https://auth.alpari.io/signin`;
      logger.info(`${TAG} POST: ${api}`);

      request.post({
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        url: api,
        body: `{\"account_id\":\"${accountId}\",\"password\":\"${password}\"}`
      }, (error, response, body) => {
        if (error) {
          logger.error(error);
          resolve(error.message);
        } else {
          logger.info(`${TAG} ${accountId} Body: ${body}`);
          try {
            let token = JSON.parse(body)["token"];
            resolve(token);
          } catch (e) {
            resolve(body);
          }
        }
      });
    });
  };

  /**
   * Connect to wstrade
   * @param sid
   * @param accountId
   */
  wstradeConnect = (sid: string, accountId: string): void => {
    this.tasks[accountId] = {
      client: <any>null,
      tryRestartCounter: 0,
      maxTryRestartCounter: 5
    };
    this.tasks[accountId].client = new WebSocketClient();
    this.tasks[accountId].client.connect(`wss://wstrade.alpari.io/socket.io/?EIO=3&transport=websocket&sid=${sid}`);
    this.tasks[accountId].client.on('connectFailed', (error) => {
      logger.error('Connect Error: ' + error.toString());
      this.tryToReConnect(accountId).then();
    });
    this.tasks[accountId].client.on('connect', (connection) => {
      try {
        this.tasks[accountId].tryRestartCounter = 0;
        this.tasks[accountId].client.connection = connection;
        // Flag for handshake status
        let handshakeSuccessfully = false;
        // Flag for ping schedule has been setup
        let pingSchedule = false;

        logger.info(`${TAG} ${accountId} WebSocket Client Connected`);

        connection.on('error', (error) => {
          logger.error(`${TAG} ${accountId} Connection Error: ${error.toString()}`);
          this.tryToReConnect(accountId).then();
        });
        connection.on('close', () => {
          logger.warn(`${TAG} ${accountId} Connection Closed`);
          this.tryToReConnect(accountId).then();
        });
        connection.on('message', async (message) => {
          if (message.type === 'utf8') {
            let body = message.utf8Data;
            if (body === "3probe") {
              connection.sendUTF('5');
              handshakeSuccessfully = true
            } else {

              try {
                if (body.length > 7) {
                  let jsonContent = body.substr(2, body.length - 2);
                  let jsonResponse = JSON.parse(jsonContent);

                  let titleCommand = jsonResponse[0];
                  let contentObject = jsonResponse[1];
                  // OrderResult: {"result":"ok","action":"buy","message":"(BTC-USD) buy success"}
                  // account_data: {"account_status":1,"account_balance":260300000000,"orders":{"BTC-USD":{"buy_amount":100000000,"sell_amount":0}}}
                  // account_data: {"account_status":1,"account_balance":98280000000,"orders":{}}
                  // TradeResult: {"status":1,"message":"+0.95"}
                  // logout: {}
                  let contentString = JSON.stringify(contentObject);
                  logger.info(`${TAG} ${accountId} Response: ${titleCommand}: ${contentString}`);

                  // @nhancv 2019-09-07: Get alias for notify
                  let accountAlias = this.config.tradeUsers[accountId].accountAlias;
                  accountAlias = accountAlias ? accountAlias : accountId;

                  if (titleCommand === "TradeResult") {
                    let status = contentObject["status"];
                    let encourageMessage = `${status > 0 ? (' => ' + this.config.winFunnyMessage[Math.floor(Math.random() * this.config.winFunnyMessage.length)].message)
                      : (' => ' + this.config.loseFunnyMessage[Math.floor(Math.random() * this.config.loseFunnyMessage.length)].message)}`;
                    this.notifyOnChatHook(this.config.tradeUsers[accountId].chatId,
                      `${accountAlias} Kết quả: ${status > 0 ? 'WIN' : 'LOSE'} (${contentObject["message"]}) ${encourageMessage}`);
                  } else if (titleCommand === "OrderResult") {
                    let result = contentObject["result"];
                    if (result === "error") {
                      await this.marketStopTask(accountId, contentObject["message"]);
                    }
                  } else if (titleCommand === "account_data") {
                    let balance = parseInt(contentObject["account_balance"]) / 1e8;
                    let orderLength = Object.keys(contentObject["orders"]).length;
                    if (orderLength > 0) {
                      let buyAmount = parseInt(contentObject["orders"]["BTC-USD"]["buy_amount"]) / 1e8;
                      let sellAmount = parseInt(contentObject["orders"]["BTC-USD"]["sell_amount"]) / 1e8;
                      let twoOrder = buyAmount > 0 && sellAmount > 0;
                      if (twoOrder) {
                        this.notifyOnChatHook(this.config.tradeUsers[accountId].chatId,
                          `${accountAlias} Tổng : BUY $${buyAmount}, SELL $${sellAmount}`);
                      } else {
                        this.notifyOnChatHook(this.config.tradeUsers[accountId].chatId,
                          `${accountAlias} Tổng ${buyAmount > 0 ? ('BUY $' + buyAmount + ' thành công') : ''}${sellAmount > 0 ? ('SELL $' + sellAmount + ' thành công') : ''}`);
                      }
                    } else {
                      this.notifyOnChatHook(this.config.tradeUsers[accountId].chatId,
                        `${accountAlias} Số dư: $${balance}`);
                    }
                    if (balance === 0) {
                      await this.marketStopTask(accountId, "Balance is 0");
                    }
                  } else if (titleCommand === "logout") {
                    //@nhancv 2019-09-02: need send ping alive then active token again
                    logger.info(`${TAG} ${accountId} Token balance expired`);
                    this.sendPingKeepAlive(accountId);
                    await this.tryToReConnect(accountId);
                  }
                }
              } catch (e) {
                logger.info(`${TAG} ${accountId} Received: '${body}'`);
              }
            }

            if (handshakeSuccessfully && !pingSchedule) {
              this.sendPingNumber(accountId, connection);
              pingSchedule = true;
            }
          }
        });
      } catch (e) {
        logger.error(e);
      }

      function sendHandshake() {
        if (connection && connection.connected) {
          connection.sendUTF('2probe');
        }
      }

      sendHandshake();
    });
  };

  /**
   * Send ping number to keep socket alive
   * @param accountId
   * @param connection
   */
  sendPingNumber(accountId: string, connection: any) {
    try {
      if (connection && connection.connected) {
        connection.sendUTF('2');
        setTimeout(() => {
          this.sendPingNumber(accountId, connection);
        }, 24999);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Send ping keep token alive
   * @param accountId
   */
  sendPingKeepAlive(accountId: string) {
    try {
      let connection = this.tasks[accountId].client.connection;
      if (connection && connection.connected) {
        let keepAliveMsg = `42[\"keep_alive\",{\"uid\":\"${this.config.tradeUsers[accountId].userId}\",\"account_id\":\"${this.config.tradeUsers[accountId].accountId}\",\"token\":\"${this.config.tradeUsers[accountId].token}\"}]`;
        connection.sendUTF(keepAliveMsg);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   var a = parseInt((1e8 * r).toFixed(0)), s = md5([i, t, n, e, a].join(","));
   this.props.common.trading_socket.emit("send_order", {
      u_token: o,
      t: s,
      account_id: i,
      pair_id: t,
      wallet: n,
      action: e,
      amount: r
   })
   * @param accountId
   * @param connection
   * @param amount
   * @param type
   */
  submitTradeAction(accountId: string, connection: any, amount: number, type: string) {
    try {
      if (connection && connection.connected) {
        let u_token = this.config.tradeUsers[accountId].token;
        let account_id = this.config.tradeUsers[accountId].accountId;
        let pair_id = "BTC-USD";
        let wallet = 0;
        let action = type;

        let a = parseInt((1e8 * amount).toFixed(0));
        let s = [account_id, pair_id, wallet, action, a].join(",");
        let t = crypto.createHash('md5').update(s).digest("hex");

        let command = `42[\"send_order\",{\"u_token\":\"${u_token}\",\"t\":\"${t}\",\"account_id\":\"${account_id}\",\"pair_id\":\"${pair_id}\",\"wallet\":${wallet},\"action\":\"${action}\",\"amount\":${amount}}]`;
        connection.sendUTF(command);
        logger.info(`${TAG} ${accountId} Request order: ${type} $${amount}`);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Send buy oder
   * @param accountId
   * @param connection
   * @param amount
   */
  sendBuyOrder(accountId: string, connection: any, amount: number) {
    this.submitTradeAction(accountId, connection, amount, "buy");
  }

  /**
   * Send sell order
   * @param accountId
   * @param connection
   * @param amount
   */
  sendSellOrder(accountId: string, connection: any, amount: number) {
    this.submitTradeAction(accountId, connection, amount, "sell");
  }

  /**
   * Send ping keep alive in new session. This function be triggered from price alert
   */
  newSession() {
    try {
      for (let accountId in this.tasks) {
        if (this.tasks.hasOwnProperty(accountId) &&
          this.tasks[accountId].client && this.tasks[accountId].client.connection && this.tasks[accountId].client.connection.connected) {
          this.sendPingKeepAlive(accountId);
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Refresh missing tasks
   */
  async refreshMissingTasks() {
    try {
      // In case new account added from cloud, need to start it
      for (let accountId in this.config.tradeUsers) {
        if (this.config.tradeUsers.hasOwnProperty(accountId) && !this.tasks.hasOwnProperty(accountId)) {
          // Check stop flag status in config
          if (this.config.tradeUsers[accountId].start === true
            && this.config.tradeUsers[accountId].isRunning === true) {
            await this.execute(accountId);
          }
        }
      }
      // In case the cloud remove account, need to stop it
      for (let accountId in this.tasks) {
        // Check stop flag status in config
        if (this.tasks.hasOwnProperty(accountId)) {
          if (!this.config.tradeUsers.hasOwnProperty(accountId)) {
            this.stopTask(accountId);
            delete this.tasks[accountId];
          } else if (this.config.tradeUsers[accountId].start === false
            || this.config.tradeUsers[accountId].isRunning === false) {
            this.stopTask(accountId);
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }

  }

  /**
   * Perform trade trigger from wsprice notify. Map amount continuous same color candle
   * with amountStrategy array to get final amount.
   * @param isGreenCandle
   * @param amountCandles
   * @param colorList
   */
  async trade(isGreenCandle: boolean, amountCandles: number, colorList: number[]) {
    try {
      let now = moment.utc().utcOffset(timeZone);
      if (now.second() >= 30) return;
      for (let accountId in this.tasks) {
        try {
          if (this.tasks.hasOwnProperty(accountId) && this.config.tradeUsers.hasOwnProperty(accountId)) {
            let isRunning = this.config.tradeUsers[accountId]["isRunning"]
              && this.config.tradeUsers[accountId]["start"];
            if (isRunning) {
              if (this.tasks[accountId].client
                && this.tasks[accountId].client.connection
                && this.tasks[accountId].client.connection.connected) {
                let conn = this.tasks[accountId].client.connection;

                let tradeUser: TradeUser = this.config.tradeUsers[accountId];
                let strategyId = tradeUser.strategyRunning;
                let orderChecking: { buy: boolean, amount: number, data?: any } | null = null;
                if (strategyId === "default_order") {
                  // @nhancv 9/18/19: Default order
                  orderChecking = this.defaultOrder.apply(isGreenCandle, amountCandles, this.config.tradeUsers[accountId]);
                } else {
                  // @nhancv 9/18/19: External order
                  orderChecking = await this.applyExternalStrategy(strategyId, isGreenCandle, amountCandles, colorList, accountId, tradeUser.amountStrategy);
                }
                // @nhancv 10/14/19: Apply order
                if (orderChecking && orderChecking.amount > 0) {
                  this.applyOrderChecking(orderChecking, accountId, conn);
                }
              }
            }
          }
        } catch (e) {
          logger.error(e);
          if (this.tasks && this.tasks.hasOwnProperty(accountId)) {
            this.notifyOnSystemHook(`${accountId} Market error: ${e.message}`);
          }
        }
      }
    } catch (e) {
      logger.error(e);
      this.notifyOnSystemHook(`Market error: ${e.message}`);
    }
  }

  /**
   * Apply order checking strategy
   * @param defaultChecking
   * @param accountId
   * @param conn
   */
  private applyOrderChecking(defaultChecking: { buy: boolean, amount: number, data?: any }, accountId: string, conn) {
    if (defaultChecking.amount > 0) {
      if (defaultChecking.data) {
        this.notifyOnChatHook(this.config.tradeUsers[accountId].chatId, defaultChecking.data);
      }
      if (!defaultChecking.buy) {
        this.sendSellOrder(accountId, conn, defaultChecking.amount);
      } else {
        this.sendBuyOrder(accountId, conn, defaultChecking.amount);
      }
    }
  }

  /**
   * Try to reconnect if has error
   */
  tryToReConnect = async (accountId: string): Promise<void> => {
    let msg = `${TAG} ${accountId} re-connect to server`;
    logger.info(msg);
    try {
      await this.stopTask(accountId, false);
      this.tasks[accountId].tryRestartCounter++;
      if (this.tasks[accountId].tryRestartCounter <= this.tasks[accountId].maxTryRestartCounter) {
        this.execute(accountId).then();
      }
    } catch (e) {
      logger.error(e);
    }
  };

  /**
   * Reset strategy config
   */
  cleanExternalStrategy = async (accountId: string, strategyId: string): Promise<string> => {
    const body = {
      strategyId: strategyId,
      accountId: accountId,
    };
    return new Promise((resolve, reject) => {
      request.put({
        headers: {'content-type': 'application/json', 'token': STRATEGY_AUTH_TOKEN},
        url: `${STRATEGY_HOST}/api/strategy`,
        body: JSON.stringify(body)
      }, (error, response, body) => {
        try {
          if (error) {
            logger.info(`${TAG} ${accountId} cleanExternalStrategy error: ${error.message}`);
            reject(error);
          } else {
            logger.info(`${TAG} ${accountId} cleanExternalStrategy body: ${body}`);
            resolve(body);
          }
        } catch (e) {
          reject(error);
        }
      });
    });
  };

  /**
   * Apply external strategy
   * @param strategyId
   * @param isGreen
   * @param candles
   * @param colorList
   * @param accountId
   * @param accountAmounts
   */
  applyExternalStrategy = async (strategyId: string, isGreen: boolean, candles: number, colorList: number[], accountId: string, accountAmounts: number[]): Promise<{ buy: boolean, amount: number, data?: any }> => {
    const body: IStrategyReq = {
      strategyId: strategyId,
      isGreen: isGreen,
      candles: candles,
      colorList: colorList,
      accountId: accountId,
      accountAmounts: accountAmounts
    };
    const request = require('request');
    return new Promise((resolve, reject) => {
      request.post({
        headers: {'content-type': 'application/json', 'token': STRATEGY_AUTH_TOKEN},
        url: `${STRATEGY_HOST}/api/strategy`,
        body: JSON.stringify(body)
      }, (error, response, body) => {
        try {
          if (error) {
            logger.info(`${TAG} ${accountId} applyExternalStrategy ${strategyId} error: ${error.message}`);
            resolve({buy: true, amount: 0});
          } else {
            logger.info(`${TAG} ${accountId} applyExternalStrategy ${strategyId} body: ${body}`);
            let result: IStrategyRes = JSON.parse(body);
            if (result.code === 200 && result.body) {
              resolve({buy: result.body.buy, amount: result.body.amount, data: result.body.data});
            } else {
              resolve({buy: true, amount: 0});
            }
          }
        } catch (e) {
          resolve({buy: true, amount: 0});
        }
      });
    });
  };

}
