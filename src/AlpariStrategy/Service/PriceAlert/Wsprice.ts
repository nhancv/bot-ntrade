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
import * as Util from "../../Utils/Util";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');
const timeZone = "+0700";

const WebSocketClient = require('websocket').client;
const TAG = '[Wsprice]';
/**
 * This class implement price alerting when the market has from 5 same color candles continuous
 */
export default class Wsprice implements LifeCycle {

  client: any;
  config: any;
  tryRestartCounter: number = 0;
  maxTryRestartCounter: number = 5;
  // GREEN if open < close otherwise RED
  lastPriceGreenColor: boolean = false;
  // This value present for number same color candle continuous
  sameGREENContinuousCounter: number = 0;
  sameREDContinuousCounter: number = 0;
  // Save candle list: 0-Green, 1-Red
  colorList: number[] = [];

  notifyOnChatHook: (dataLog: string) => void = () => {
    // ignore
  };
  notifyOnSystemHook: (dataLog: string) => void = () => {
    // ignore
  };
  notifyOnPriceHook: (isGreenCandle: boolean, amountCandles: number, colorList: number[]) => void = () => {
    // ignore
  };
  notifyOnNewSessionHook: () => void = () => {
    // ignore
  };
  notifyOnCloseOrderHook: () => void = () => {
    // ignore
  };

  constructor(config: any) {
    this.config = config;
  }

  async onCreate() {
    this.resetNoticeValue();
  }

  async onStart() {
    await this.execute();
  }

  async onStop() {
    try {
      logger.info(`${TAG} onStop`);
      if (this.client != null) {
        let conn = this.client.connection;
        if (conn) {
          conn.close();
          conn.removeAllListeners();
        }
        this.client = null;
      }
      this.tryRestartCounter = 0;
      this.maxTryRestartCounter = 5;
    } catch (e) {
      logger.error(e);
    }

  }

  async onDestroy() {
  }

  /**
   * Publish message to chat
   * @param onChat
   */
  onChatHook(onChat: (dataLog: string) => void) {
    this.notifyOnChatHook = onChat;
  }

  /**
   * Publish system message to chat
   * @param onSystem
   */
  onSystemHook(onSystem: (dataLog: string) => void) {
    this.notifyOnSystemHook = onSystem;
  }

  /**
   * Publish price signal
   * @param onPrice
   */
  onPriceHook(onPrice: (isGreenCandle: boolean, amountCandles: number, candleList: number[]) => void) {
    this.notifyOnPriceHook = onPrice
  }

  /**
   * Publish new session signal
   * @param onNewSession
   */
  onNewSessionHook(onNewSession: () => void) {
    this.notifyOnNewSessionHook = onNewSession
  }

  /**
   * Publish close order signal
   * @param onCloseOrder
   */
  onCloseOrderHook(onCloseOrder: () => void) {
    this.notifyOnCloseOrderHook = onCloseOrder
  }

  /**
   api1:GET https://wsprice.alpari.io/socket.io/?EIO=3&transport=polling
   97:0{"sid":"UPZOG_fJBnlRL3dLAgSb","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}2:40

   api2: Get price list
   https://wsprice.alpari.io/socket.io/?EIO=3&transport=polling&sid=UPZOG_fJBnlRL3dLAgSb

   Websocket: wss://wsprice.alpari.io/socket.io/?EIO=3&transport=websocket&sid=UPZOG_fJBnlRL3dLAgSb
   send: 2probe
   recv: 3probe
   send: 5
   recv: data realtime
   Keep alive by send interval every 25s: 2

   * FLOW to connect websocket wsprice
   1. First call api1 to get sid
   2. Connect to websocket with sid from api1
   3: Send handshake message '2probe' via websocket. Response for handshake message is '3probe', then handshake will be setup fine
   4: Create schedule ping every 25 seconds

   */
  async execute() {

    try {
      let sid: string = await this.api1();
      logger.info(`${TAG} Sid: ${sid}`);
      if (!sid) return;
      await this.api2(sid);
      this.wspriceConnect(sid);

    } catch (e) {
      this.tryToReConnect().then();
      logger.error(e);
      return;
    }
  }

  /**
   * Call api get sid
   */
  api1 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      request(
        `https://wsprice.alpari.io/socket.io/?EIO=3&transport=polling`,
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
   * Call api get sid
   */
  api2 = (sid: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      request(
        `https://wsprice.alpari.io/socket.io/?EIO=3&transport=polling&sid=${sid}`,
        (error, response, body) => {
          if (error) {
            logger.error(error);
            reject(error);
          } else {
            try { // logger.info(`${TAG} Body: ${body}`);
              // Restore Notice data
              let lastRealDataIndex = body.lastIndexOf('["RealData",{');
              let lastRealData = body.substr(lastRealDataIndex, body.length - lastRealDataIndex);
              let lastRealDataJSON = JSON.parse(lastRealData)[1];
              let dataChart: any[] = lastRealDataJSON["data_chart"];
              let timeInSecond: number = lastRealDataJSON["time"]["second"];

              // @nhancv 2019-09-10: Filter data
              dataChart = dataChart.filter(data => {
                // ["2019-09-10 15:24:30",[10220.057,10222,10219.777,10226.747],69942,52.5,47.5]
                let second = moment(data[0], "YYYY-MM-DD HH:mm:ss").seconds();
                return second == 30;
              }).map(data => {
                let openP = data[1][0];
                let closeP = data[1][1];
                // 0: Green - Open price <= Close price
                return openP <= closeP ? 0 : 1;
              });
              if (timeInSecond < 20 || timeInSecond > 29) {
                dataChart.splice(dataChart.length - 1, 1);
              }
              // @nhancv 10/15/19: Save to global list
              this.colorList = dataChart;

              // @nhancv 2019-09-10: Calculate Notice value
              for (let i = 0; i < dataChart.length; i++) {
                this.lastPriceGreenColor = dataChart[i] === 0;
                if (this.lastPriceGreenColor) {
                  this.sameGREENContinuousCounter++;
                  this.sameREDContinuousCounter = 0;
                } else {
                  this.sameREDContinuousCounter++;
                  this.sameGREENContinuousCounter = 0;
                }
              }
              if (this.lastPriceGreenColor) {
                logger.info(`${TAG} Current status: ${this.sameGREENContinuousCounter} GREEN candles`);
              } else {
                logger.info(`${TAG} Current status: ${this.sameREDContinuousCounter} RED candles`);
              }
              resolve();
            } catch (e) {
              this.resetNoticeValue();
              logger.error(e);
              reject(e);
            }
          }
        }
      );
    });
  };

  /**
   * Connect to wsprice socket
   * @param sid
   */
  wspriceConnect = (sid: string): void => {
    try {
      this.client = new WebSocketClient();

      this.client.connect(`wss://wsprice.alpari.io/socket.io/?EIO=3&transport=websocket&sid=${sid}`);
      this.client.on('connectFailed', (error) => {
        logger.error('Connect Error: ' + error.toString());
        this.tryToReConnect().then();
      });
      this.client.on('connect', (connection) => {
        this.tryRestartCounter = 0;
        this.client.connection = connection;

        // Flag for handshake status
        let handshakeSuccessfully = false;
        // Flag for ping schedule has been setup
        let pingSchedule = false;
        // Flag for checking price or not
        // Gray candle: 0s - 29s
        // Color candle: 30s - 59s
        // For safety, we DO NOT check price at transfer time moment, the better time will be in gray candle at 5s to 19s
        // We delay 5s after new_session for check price, then continuous delay 10s for order
        // => The end of order_time will stop at 30th second
        // => Need check price from 5s to 19s => order time will be 15s to 29s
        let checkPrice = false;

        logger.info(`${TAG} WebSocket Client Connected`);

        connection.on('error', (error) => {
          logger.error(`${TAG} Connection Error: ${error.toString()}`);
          this.tryToReConnect().then();
        });
        connection.on('close', () => {
          logger.warn(`${TAG} Connection Closed`);
          this.tryToReConnect().then();
        });
        connection.on('message', (message) => {
          let thresholdCandlesNotifyTrigger = this.config.priceBot.thresholdCandlesNotifyTrigger;
          let thresholdCandlesSuggestTrigger = this.config.priceBot.thresholdCandlesSuggestTrigger;
          if (message.type === 'utf8') {
            let body = message.utf8Data;
            if (body === "3probe") {
              connection.sendUTF('5');
              handshakeSuccessfully = true
            } else {

              try {
                if (body.length > 15) {
                  let jsonContent = body.substr(2, body.length - 2);
                  let jsonResponse = JSON.parse(jsonContent);

                  let titleCommand = jsonResponse[0];
                  let contentObject = jsonResponse[1];
                  if (titleCommand === "RealData") {

                    // @nhancv 2019-08-29: Check time.
                    let datetime = contentObject["time"]["datetime"];
                    let timeInSecond = contentObject["time"]["second"];

                    // @nhancv 2019-09-12: Check at start_session time
                    // @nhancv 2019-08-29: Accept order (GRAY volume). Time will start from 0th in second
                    // For safety should delay in 5 seconds
                    if (!checkPrice && timeInSecond >= 5 && timeInSecond < 20) {
                      // @nhancv 2019-09-12: Get last candle status
                      // @nhancv 2019-08-29: End of current session. Time counter at 59th in second
                      // @nhancv 2019-08-29: Save to last price
                      let dataChart = contentObject["data_chart"];
                      // Datachart will be 70 candles index from 0 - 69
                      // at second is 0 mean in next session, we get last candle by index 68
                      // Price open, close, lowest, highest
                      let candleData = dataChart[dataChart.length - 2];
                      let oclh = candleData[1];
                      let openP = oclh[0];
                      let closeP = oclh[1];
                      // @nhancv 9/18/19: Get vol
                      let totalVol = candleData[2];
                      let buyVol = Util.precisionFloorRound(totalVol * candleData[3] / 100, 2);
                      let sellVol = Util.precisionFloorRound(totalVol * candleData[4] / 100, 2);

                      // @nhancv 2019-08-29: Update last price green color flag
                      this.lastPriceGreenColor = openP <= closeP;

                      // @nhancv 10/15/19: Update candle list
                      this.colorList.splice(0, 1);
                      this.colorList.push(this.lastPriceGreenColor ? 0 : 1);

                      logger.info(`${TAG} Date time: ${datetime}:${timeInSecond} - Vol: ${totalVol} [B:${buyVol}, S:${sellVol}] - ${this.lastPriceGreenColor ? 'GREEN' : 'RED__'} - price: ${oclh}`);

                      //////////////////////////////////////////
                      //////////////////////////////////////////
                      //////////////////////////////////////////
                      // @nhancv 2019-09-12: notify and order
                      this.notifyOnNewSessionHook();
                      // Checking
                      // Update counter by last price color
                      if (this.lastPriceGreenColor) {
                        this.sameGREENContinuousCounter++;
                        this.sameREDContinuousCounter = 0;
                      } else {
                        this.sameREDContinuousCounter++;
                        this.sameGREENContinuousCounter = 0;
                      }

                      // Notify if market has 5 candles same color continuous
                      let currentTime = moment.utc().utcOffset(timeZone).format("HH:mm");
                      if (this.sameGREENContinuousCounter >= thresholdCandlesNotifyTrigger) {
                        let sellSuggest = this.sameGREENContinuousCounter >= thresholdCandlesSuggestTrigger ? '=> SELL now' : '';
                        let notifyMsg = `${this.sameGREENContinuousCounter} GREEN 🍏 at ${currentTime} [BUY:${buyVol}, SELL️:${sellVol}] ${sellSuggest} `;
                        // @nhancv 2019-08-31: Notify to alert price
                        this.notifyOnChatHook(notifyMsg);
                        logger.info(`${TAG} ALERT ${notifyMsg}`);
                      } else if (this.sameREDContinuousCounter >= thresholdCandlesNotifyTrigger) {
                        let buySuggest = this.sameREDContinuousCounter >= thresholdCandlesSuggestTrigger ? '=> BUY now' : '';
                        let notifyMsg = `${this.sameREDContinuousCounter} RED 🍎 at ${currentTime} [BUY:${buyVol}, SELL:${sellVol}] ${buySuggest} `;
                        // @nhancv 2019-08-31: Notify to alert price
                        this.notifyOnChatHook(notifyMsg);
                        logger.info(`${TAG} ALERT ${notifyMsg}`);
                      } else if (this.sameGREENContinuousCounter > 0) {
                        let notifyMsg = `${this.sameGREENContinuousCounter} GREEN 🍏 at ${currentTime} Vol: ${totalVol} [B:${buyVol}, S:${sellVol}]`;
                        logger.info(`${TAG} ALERT ${notifyMsg}`);
                      } else if (this.sameREDContinuousCounter > 0) {
                        let notifyMsg = `${this.sameREDContinuousCounter} RED 🍎 at ${currentTime} Vol: ${totalVol} [B:${buyVol}, S:${sellVol}]`;
                        logger.info(`${TAG} ALERT ${notifyMsg}`);
                      }
                      // @nhancv 2019-08-31: Notify to trade
                      if (this.sameGREENContinuousCounter > this.sameREDContinuousCounter) {
                        this.notifyOnPriceHook(this.lastPriceGreenColor, this.sameGREENContinuousCounter, this.colorList);
                      } else {
                        this.notifyOnPriceHook(this.lastPriceGreenColor, this.sameREDContinuousCounter, this.colorList);
                      }
                      // @nhancv 2019-09-12: Update flag check price
                      checkPrice = true;
                    }

                  } else if (titleCommand === "start_session") {
                    checkPrice = false;
                    // @nhancv 2019-09-12: We DONT order or check price here for safety
                    logger.info(`${TAG} ${body}`);
                  } else if (titleCommand === "close_order") {
                    this.notifyOnCloseOrderHook();
                    // @nhancv 2019-08-29: Pending order (Colors volume). Time will start from 30th in second
                    // logger.info(`${TAG} ${body}`);
                  }
                }
              } catch (e) {
                logger.info(`${TAG} Received: '${body}'`);
                this.notifyOnSystemHook(`Market error: ${e.message}`);
              }
            }

            if (handshakeSuccessfully && !pingSchedule) {
              this.sendPingNumber(connection);
              pingSchedule = true;
            }

          }
        });

        function sendHandshake() {
          if (connection.connected) {
            connection.sendUTF('2probe');
          }
        }

        sendHandshake();
      });
    } catch (e) {
      logger.error(e);
    }
  };

  /**
   * Send ping number to keep socket alive
   * @param connection
   */
  sendPingNumber(connection: any) {
    try {
      if (connection && connection.connected) {
        connection.sendUTF('2');
        // logger.info(`${TAG} Ping server number 2`);
        setTimeout(() => {
          this.sendPingNumber(connection);
        }, 24999);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Try to reconnect if has error
   */
  tryToReConnect = async (): Promise<void> => {
    logger.info(`${TAG} re-connect to server`);
    try {
      await this.onStop();

      this.tryRestartCounter++;
      if (this.tryRestartCounter <= this.maxTryRestartCounter) {
        this.execute().then();
      }
    } catch (e) {
      logger.error(e);
    }
  };

  /**
   * Reset notice value
   */
  resetNoticeValue() {
    this.lastPriceGreenColor = false;
    this.sameGREENContinuousCounter = 0;
    this.sameREDContinuousCounter = 0;
  }

}
