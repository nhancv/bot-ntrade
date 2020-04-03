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

import PriceBot from "./Service/PriceAlert/PriceBot";
import Wsprice from "./Service/PriceAlert/Wsprice";
import * as ENV from "./Env";
import TradeBot from "./Service/TradeAuto/TradeBot";
import Wstrade from "./Service/TradeAuto/Wstrade";
import AgentBot from "./Service/AgentBot";
import MongoStore from "./Provider/MongoDB/MongoStore";
import {TradeUser} from "./Model/TradeUser";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');

/**
 ## Binary Strategy for http://alpari.io market
 - Alert if has >= 5 red candles continuous
 */
export async function execute() {
  try {
    // @nhancv 2019-08-31: Get config
    const config = ENV.get();

    // @nhancv 2019-09-01: Create Store
    const store = new MongoStore(config);
    await store.onCreate();

    // @nhancv 2019-09-03: Create AgentBot
    const agentBot = new AgentBot(config);
    await agentBot.onCreate();

    // @nhancv 2019-08-31: Create PriceBot
    const priceBot = new PriceBot(config);
    await priceBot.onCreate();

    // @nhancv 2019-08-31: Create Wsprice
    const wsprice = new Wsprice(config);
    await wsprice.onCreate();

    // @nhancv 2019-08-31: Create TradeBot
    const tradeBot = new TradeBot(config);
    await tradeBot.onCreate();

    // @nhancv 2019-08-31: Create Wstrade
    const wstrade = new Wstrade(config);
    await wstrade.onCreate();

    // @nhancv 2019-08-31: Link

    // @nhancv 2019-09-03: Link Agent bot
    agentBot.onRetrieveTokenHook((accountId: string, password: string): Promise<string> => {
      try {
        return wstrade.tokenRetrieve(accountId, password)
      } catch (e) {
        logger.error(e);
        return Promise.resolve("RetrieveToken Error");
      }
    });
    agentBot.onAddUserHook(async (userId: string, accountId: string, userName: string): Promise<string> => {
      try {
        return await store.addUserConfig(userId, accountId, userName);
      } catch (e) {
        logger.error(e);
        return Promise.resolve("AddUser Error");
      }
    });
    agentBot.onAddBotHook(async (userId: string, accountId: string, password: string, chatId: string): Promise<string> => {
      try { // Create user on store
        let token = await wstrade.tokenRetrieve(accountId, password);
        if (token != undefined && token.length === 124) {
          let result = await store.createNewBotConfig(userId, accountId, token, chatId);
          return Promise.resolve(result);
        } else {
          return Promise.resolve(token);
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("AddBot Error");
      }
    });
    agentBot.onRootStartBotHook(async (accountId: string): Promise<string> => {
      try {
        let isEdited = false;
        if (accountId === "all") {
          for (let id in config.tradeUsers) {
            let newTradeUserObject = config["tradeUsers"][id];
            if (newTradeUserObject) {
              newTradeUserObject["start"] = true;
              await store.setBotRootStatusByUser(id, newTradeUserObject);
              isEdited = true;
            }
          }
        } else if (accountId.length > 3) {
          let newTradeUserObject = config["tradeUsers"][accountId];
          if (newTradeUserObject) {
            newTradeUserObject["start"] = true;
            await store.setBotRootStatusByUser(accountId, newTradeUserObject);
            isEdited = true;
          }
        }
        return Promise.resolve(isEdited ? "RootStartBot Ok" : "RootStart Not found");
      } catch (e) {
        logger.error(e);
        return Promise.resolve("RootStart Error");
      }
    });
    agentBot.onRootStopBotHook(async (accountId: string): Promise<string> => {
      try {
        let isEdited = false;
        if (accountId === "all") {
          for (let id in config.tradeUsers) {
            let newTradeUserObject = config["tradeUsers"][id];
            if (newTradeUserObject) {
              newTradeUserObject["start"] = false;
              await store.setBotRootStatusByUser(id, newTradeUserObject);
              isEdited = true;
            }
          }
        } else if (accountId.length > 3) {
          let newTradeUserObject = config["tradeUsers"][accountId];
          if (newTradeUserObject) {
            newTradeUserObject["start"] = false;
            await store.setBotRootStatusByUser(accountId, newTradeUserObject);
            isEdited = true;
          }
        }
        return Promise.resolve(isEdited ? "RootStopBot Ok" : "RootStopBot Not found");
      } catch (e) {
        logger.error(e);
        return Promise.resolve("RootStopBot Error");
      }
    });
    agentBot.onEditTimeHook(async (accountId: string, startTime: string, stopTime: string): Promise<string> => {
      try {
        let newTradeUserObject: TradeUser = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject.startTrade = startTime;
          newTradeUserObject.stopTrade = stopTime;
          return await store.setBotTime(accountId, newTradeUserObject);
        } else {
          return Promise.resolve("EditTime Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("EditTime Error");
      }
    });
    agentBot.onSplitCandlesHook(async (accountId: string, splitCandleThStrategy: number, splitOffsetStrategy: number): Promise<string> => {
      try {
        let newTradeUserObject: TradeUser = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject.splitCandleThStrategy = splitCandleThStrategy;
          newTradeUserObject.splitOffsetStrategy = splitOffsetStrategy;
          return await store.setSplitStrategy(accountId, newTradeUserObject);
        } else {
          return Promise.resolve("SplitStrategy Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("SplitStrategy Error");
      }
    });
    agentBot.onUserActiveOrderIdHook(async (accountId: string, strategyId: string): Promise<string> => {
      try {
        let newTradeUserObject: TradeUser = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          let strategyList = newTradeUserObject.strategyList;
          let findI = strategyList.indexOf(strategyId);
          if (findI !== -1) {
            newTradeUserObject.strategyRunning = strategyId;
            return await store.setStrategyRunning(accountId, newTradeUserObject);
          } else {
            return Promise.resolve(`SetStrategyRunning ${strategyId} does not exist`);
          }
        } else {
          return Promise.resolve("SetStrategyRunning Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("SetStrategyRunning Error");
      }
    });
    agentBot.onUserRegisterOrderIdHook(async (accountId: string, strategyId: string): Promise<string> => {
      try {
        let newTradeUserObject: TradeUser = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          let strategyList = newTradeUserObject.strategyList;
          if (strategyList.indexOf(strategyId) === -1) {
            strategyList.push(strategyId);
            newTradeUserObject.strategyList = strategyList;
            return await store.setStrategyList(accountId, newTradeUserObject);
          } else {
            return Promise.resolve(`RegisterStrategy ${strategyId} was already added`);
          }
        } else {
          return Promise.resolve("RegisterStrategy Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("RegisterStrategy Error");
      }
    });
    agentBot.onUserClearOrderCacheHook(async (accountId: string, strategyId: string): Promise<string> => {
      try {
        if (accountId == "all") {
          return await wstrade.cleanExternalStrategy(accountId, strategyId);
        } else {
          let newTradeUserObject: TradeUser = config["tradeUsers"][accountId];
          if (newTradeUserObject) {
            let strategyList = newTradeUserObject.strategyList;
            let findI = strategyList.indexOf(strategyId);
            if (findI !== -1) {
              return await wstrade.cleanExternalStrategy(accountId, strategyId);
            } else {
              return Promise.resolve(`UserClearOrderCache ${strategyId} does not exist`);
            }
          } else {
            return Promise.resolve("UserClearOrderCache Not found");
          }
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("UserClearOrderCache Error");
      }
    });
    agentBot.onUserRemoveOrderIdHook(async (accountId: string, strategyId: string): Promise<string> => {
      try {
        const defaultOrderId = "default_order";
        if (strategyId == defaultOrderId) {
          return Promise.resolve("RemoveStrategy: Can not delete default strategy");
        }

        let newTradeUserObject: TradeUser | null = config["tradeUsers"][accountId];
        if (newTradeUserObject !== null) {
          let strategyList = newTradeUserObject.strategyList;
          let findI = strategyList.indexOf(strategyId);
          if (findI !== -1) {
            strategyList.splice(findI, 1);
            newTradeUserObject.strategyList = strategyList;
            // @nhancv 10/19/19: Only clear strategy if current strategy equal which want to delete
            if (newTradeUserObject.strategyRunning == strategyId) {
              newTradeUserObject.strategyRunning = defaultOrderId;
              newTradeUserObject.amountStrategy = [0, 0, 0, 0, 0];
            }
            return await store.setStrategyList(accountId, newTradeUserObject);
          } else {
            return Promise.resolve(`RemoveStrategy ${strategyId} does not exist`);
          }
        } else {
          return Promise.resolve("RemoveStrategy Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("RemoveStrategy Error");
      }
    });
    agentBot.onVerifyUserHook(async (userId: string, accountId: string, password: string, chatId: string): Promise<string> => {
      try {
        let token = await wstrade.tokenRetrieve(accountId, password);
        if (token != undefined && token.length === 124) {
          // Create user on store
          await store.createNewBotConfig(userId, accountId, token, chatId);
          return Promise.resolve('Xác minh thành công. Vui lòng liên hệ admin để biết bước tiếp theo.');
        } else {
          return Promise.resolve(token);
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("VerifyUser Error");
      }
    });
    agentBot.onStartBotHook(async (accountId: string): Promise<string> => {
      try {
        let isEdited = false;
        if (accountId === "all") {
          for (let id in config.tradeUsers) {
            let newTradeUserObject = config["tradeUsers"][id];
            if (newTradeUserObject) {
              newTradeUserObject["isRunning"] = true;
              await store.setBotStatusByUser(id, newTradeUserObject);
              isEdited = true;
            }
          }
          if (isEdited) {
            await wstrade.onStart();
          }
        } else if (accountId.length > 3) {
          let newTradeUserObject = config["tradeUsers"][accountId];
          if (newTradeUserObject) {
            newTradeUserObject["isRunning"] = true;
            await store.setBotStatusByUser(accountId, newTradeUserObject);
            await wstrade.onResume(accountId);
            isEdited = true;
          }
        }
        return Promise.resolve(isEdited ? "StartBot Ok" : "StartBot Not found");
      } catch (e) {
        logger.error(e);
        return Promise.resolve("StartBot Error");
      }
    });
    agentBot.onStopBotHook(async (accountId: string): Promise<string> => {
      try {
        let isEdited = false;
        if (accountId === "all") {
          for (let id in config.tradeUsers) {
            let newTradeUserObject = config["tradeUsers"][id];
            if (newTradeUserObject) {
              newTradeUserObject["isRunning"] = false;
              await store.setBotStatusByUser(id, newTradeUserObject);
              isEdited = true;
            }
          }
          if (isEdited) {
            await wstrade.onStop();
          }
        } else if (accountId.length > 3) {
          let newTradeUserObject = config["tradeUsers"][accountId];
          if (newTradeUserObject) {
            newTradeUserObject["isRunning"] = false;
            await store.setBotStatusByUser(accountId, newTradeUserObject);
            await wstrade.onPause(accountId);
            isEdited = true;
          }
        }
        return Promise.resolve(isEdited ? "StopBot Ok" : "StopBot Not found");
      } catch (e) {
        logger.error(e);
        return Promise.resolve("StopBot Error");
      }
    });
    agentBot.onStartBotByUserHook(async (accountId: string): Promise<string> => {
      try {
        let newTradeUserObject = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject["isRunning"] = true;
          await store.setBotStatusByUser(accountId, newTradeUserObject);
          await wstrade.onResume(accountId);
          return Promise.resolve("Đã cập nhật trạng thái sang 'Hoạt động'");
        } else {
          return Promise.resolve("StartBotByUser Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("StartBotByUser Error");
      }
    });
    agentBot.onMaintenanceHook(async (active: boolean): Promise<string> => {
      try {
        let result = await store.setMaintenanceFlag(active);
        return Promise.resolve(result);
      } catch (e) {
        logger.error(e);
        return Promise.resolve("Maintenance Error");
      }
    });
    agentBot.onUpStrategyHook(async (strategyId: string, description: string, example: string): Promise<string> => {
      try {
        let result = await store.upStrategy(strategyId, description, example);
        return Promise.resolve(result);
      } catch (e) {
        logger.error(e);
        return Promise.resolve("UpStrategy Error");
      }
    });
    agentBot.onDownStrategyHook(async (strategyId: string): Promise<string> => {
      try {
        let result = await store.downStrategy(strategyId);
        return Promise.resolve(result);
      } catch (e) {
        logger.error(e);
        return Promise.resolve("DownStrategy Error");
      }
    });
    agentBot.onStopBotByUserHook(async (accountId: string): Promise<string> => {
      try {
        let newTradeUserObject = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject["isRunning"] = false;
          await store.setBotStatusByUser(accountId, newTradeUserObject);
          await wstrade.onPause(accountId);
          return Promise.resolve("Đã cập nhật trạng thái sang 'Dừng'");
        } else {
          return Promise.resolve("StopBotByUser Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("StopBotByUser Error");
      }
    });
    agentBot.onEditAmountHook(async (accountId: string, amount: number[]): Promise<string> => {
      try {
        let newTradeUserObject = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject["amountStrategy"] = amount;
          return await store.setAmountStrategy(accountId, newTradeUserObject);
        } else {
          return Promise.resolve("EditAmount Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("EditAmount Error");
      }
    });
    agentBot.onUserResetOrderIdListHook(async (accountId: string, strategyList: string[]): Promise<string> => {
      try {
        let newTradeUserObject: TradeUser = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject.strategyList = strategyList;
          return await store.setStrategyList(accountId, newTradeUserObject);
        } else {
          return Promise.resolve("SetStrategyList Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("SetStrategyList Error");
      }
    });
    agentBot.onEditAmountByUserHook(async (accountId: string, amount: number[]): Promise<string> => {
      try {
        let newTradeUserObject = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject["amountStrategy"] = amount;
          return await store.setAmountStrategy(accountId, newTradeUserObject);
        } else {
          return Promise.resolve("EditAmountByUser Not found");
        }
      } catch (e) {
        logger.error(e);
        return Promise.resolve("EditAmountByUser Error");
      }
    });
    // @nhancv 2019-08-31: Link wsprice -> price bot
    wsprice.onChatHook((dataLog) => {
      try {
        priceBot.sendMessage(dataLog);
      } catch (e) {
        logger.error(e);
      }
    });
    wsprice.onSystemHook(dataLog => {
      try {
        agentBot.sendMessageToAdmins(dataLog);
      } catch (e) {
        logger.error(e);
      }
    });
    // @nhancv 2019-08-31: Link wstrade -> trade bot
    wstrade.onChatHook((chatId: string, dataLog: string) => {
      try {
        tradeBot.sendMessage(chatId, dataLog);
      } catch (e) {
        logger.error(e);
      }
    });
    wstrade.onSystemHook(dataLog => {
      try {
        agentBot.sendMessageToAdmins(dataLog);
      } catch (e) {
        logger.error(e);
      }
    });
    wstrade.onStopBotByMarket(accountId => {
      try {
        let newTradeUserObject = config["tradeUsers"][accountId];
        if (newTradeUserObject) {
          newTradeUserObject["isRunning"] = false;
          store.setBotStatusByUser(accountId, newTradeUserObject);
        }
      } catch (e) {
        logger.error(e);
      }
    });

    // @nhancv 2019-08-31: Link wsprice - wstrade
    wsprice.onPriceHook(async (isGreenCandle: boolean, amountCandles: number, colorList: number[]) => {
      try {
        config.maintenance = await store.isMaintenance();
        if (!config.maintenance) {
          await store.reloadDataToMemory();
          setTimeout(async () => {
            await wstrade.trade(isGreenCandle, amountCandles, colorList);
          }, 2000);
        }
      } catch (e) {
        logger.error(e);
      }
    });
    wsprice.onNewSessionHook(() => {
      try {
        wstrade.newSession();
      } catch (e) {
        logger.error(e);
      }
    });
    wsprice.onCloseOrderHook(async () => {
      try {
        await wstrade.refreshMissingTasks();
      } catch (e) {
        logger.error(e);
      }
    });

    // @nhancv 2019-08-31: Start
    await store.onStart();

    await agentBot.onStart();
    await priceBot.onStart();
    await wsprice.onStart();

    await tradeBot.onStart();
    await wstrade.onStart();

    agentBot.sendMessageToAdmins(`App start at ${moment.utc().utcOffset("+0700").format()}`);

  } catch (e) {
    logger.error(e);
  }


}
