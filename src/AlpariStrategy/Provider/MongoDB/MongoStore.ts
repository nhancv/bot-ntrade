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

import LifeCycle from "../../Utils/LifeCycle";
import {TradeUser} from "../../Model/TradeUser";
import {TradeUserRepo} from "./Orm/TradeUserRepo";
import {ConfigEnv} from "../../Model/ConfigEnv";
import {User} from "../../Model/User";
import {HelperBot} from "../../Model/HelperBot";
import {HelperBotRepo} from "./Orm/HelperBotRepo";
import {UserRepo} from "./Orm/UserRepo";
import {PriceBot} from "../../Model/PriceBot";
import {PriceBotRepo} from "./Orm/PriceBotRepo";
import {TradeBotRepo} from "./Orm/TradeBotRepo";
import {TradeBot} from "../../Model/TradeBot";
import {SystemRepo} from "./Orm/SystemRepo";
import {FunnyMessage} from "../../Model/FunnyMessage";
import {FunnyMessageRepo} from "./Orm/FunnyMessageRepo";
import {System} from "../../Model/System";
import {Strategy} from "../../Model/Strategy";
import {StrategyRepo} from "./Orm/StrategyRepo";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');

export default class MongoStore implements LifeCycle {

  config: ConfigEnv;

  constructor(config: any) {
    this.config = config;
  }

  notifyOnDataHook: (data: any) => void = () => {
    // ignore
  };

  async onCreate() {
    await this.reloadConfig();
  }

  async onStart() {

  }

  async onStop() {
  }

  async onDestroy() {
  }

  /**
   * Get maintenance flag from data
   */
  async isMaintenance() {
    try {
      let systems: System[] = await new SystemRepo().getAll();
      if (systems.length > 0) {
        return systems[0].maintenance;
      } else {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  /**
   * Reload data to config on memory
   */
  async reloadConfig() {
    try { // @nhancv 9/14/19: load config from database server to Env.ts
      let helperBotList: HelperBot[] = await new HelperBotRepo().getAll();
      if (helperBotList.length == 0) {
        logger.error('HelperBot has not configured yet.')
      } else {
        let helperBot: HelperBot = helperBotList[0];
        helperBot.users = await new UserRepo().getAll();
        // Reload helperBot
        this.config.helperBot = helperBot;
      }
      let funnyMessages: FunnyMessage[] = await new FunnyMessageRepo().getAll();
      // Reload funnyMessage
      this.config.winFunnyMessage = funnyMessages.filter(v => v.isWin);
      this.config.loseFunnyMessage = funnyMessages.filter(v => !v.isWin);

      // Reload strategy list
      this.config.strategyList = await new StrategyRepo().getAll();

      let priceBotList: PriceBot[] = await new PriceBotRepo().getAll();
      if (priceBotList.length == 0) {
        logger.error('PriceBot has not configured yet.');
      } else {
        // Reload priceBot
        this.config.priceBot = priceBotList[0];
      }
      let tradeBotList: TradeBot[] = await new TradeBotRepo().getAll();
      if (tradeBotList.length == 0) {
        logger.error('TradeBot has not configured yet.');
      } else {
        // Reload tradeBot
        this.config.tradeBot = tradeBotList[0];
      }
      // Reload tradeUser
      let tradeUserList: TradeUser[] = await new TradeUserRepo().getAll();
      this.config.tradeUsers = {};
      tradeUserList.forEach((v: TradeUser) => {
        this.config.tradeUsers[v.accountId] = v;
      });
      logger.info('Configuration updated.');
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Reload data from store to config in memory
   */
  async reloadDataToMemory() {
    try { // @nhancv 9/14/19: Check system need to reload all config
      let hasReloaded = false;
      let systemConfigs = await new SystemRepo().getAll();
      if (systemConfigs.length > 0) {
        let systemConfig = systemConfigs[0];
        if (systemConfig.needReloadAll) {
          // @nhancv 9/14/19: Reset system needReload flag
          systemConfig.needReloadAll = false;
          systemConfig.needReloadUserCol = false;
          systemConfig.needReloadHelperBotCol = false;
          systemConfig.needReloadFunnyMessageCol = false;
          systemConfig.needReloadPriceBotCol = false;
          systemConfig.needReloadTradeBotCol = false;
          systemConfig.needReloadTradeUserCol = false;
          systemConfig.needReloadStrategyCol = false;
          // Reload to ENV.js
          await this.reloadConfig();

          hasReloaded = true;
        } else {
          if (systemConfig.needReloadUserCol) {
            systemConfig.needReloadUserCol = false;
            this.config.helperBot.users = await new UserRepo().getAll();
            logger.info('Reload User data completed.');

            hasReloaded = true;
          }
          if (systemConfig.needReloadHelperBotCol) {
            systemConfig.needReloadHelperBotCol = false;
            let helperBotList: HelperBot[] = await new HelperBotRepo().getAll();
            if (helperBotList.length > 0) {
              this.config.helperBot = helperBotList[0];
              this.config.helperBot.users = await new UserRepo().getAll();
            }
            logger.info('Reload HelperBot data completed.');
            hasReloaded = true;
          }
          if (systemConfig.needReloadPriceBotCol) {
            systemConfig.needReloadPriceBotCol = false;
            let priceBotList: PriceBot[] = await new PriceBotRepo().getAll();
            if (priceBotList.length > 0) {
              this.config.priceBot = priceBotList[0];
            }
            logger.info('Reload PriceBot data completed.');
            hasReloaded = true;
          }
          if (systemConfig.needReloadTradeBotCol) {
            systemConfig.needReloadTradeBotCol = false;
            let tradeBotList: TradeBot[] = await new TradeBotRepo().getAll();
            if (tradeBotList.length > 0) {
              this.config.tradeBot = tradeBotList[0];
            }
            logger.info('Reload TradeBot data completed.');
            hasReloaded = true;
          }
          if (systemConfig.needReloadTradeUserCol) {
            systemConfig.needReloadTradeUserCol = false;
            // @nhancv 9/14/19: Reload trade user only
            let tradeUserList: TradeUser[] = await new TradeUserRepo().getAll();
            this.config.tradeUsers = {};
            tradeUserList.forEach((v: TradeUser) => {
              this.config.tradeUsers[v.accountId] = v;
            });
            logger.info('Reload TradeUser data completed.');
            hasReloaded = true;
          }
          if (systemConfig.needReloadFunnyMessageCol) {
            systemConfig.needReloadFunnyMessageCol = false;
            // @nhancv 9/14/19: Reload funny messages
            let funnyMessages: FunnyMessage[] = await new FunnyMessageRepo().getAll();
            this.config.winFunnyMessage = funnyMessages.filter(v => v.isWin);
            this.config.loseFunnyMessage = funnyMessages.filter(v => !v.isWin);
            logger.info('Reload FunnyMessage data completed.');
            hasReloaded = true;
          }
          if (systemConfig.needReloadStrategyCol) {
            systemConfig.needReloadStrategyCol = false;
            // @nhancv 9/14/19: Reload strategy
            this.config.strategyList = await new StrategyRepo().getAll();
            logger.info('Reload Strategy data completed.');
            hasReloaded = true;
          }
        }

        // @nhancv 9/16/19: Save new config
        if (hasReloaded) {
          const result: boolean = await new SystemRepo().update({_id: systemConfig._id}, systemConfig);
          if (result) {
            logger.info('Apply new config successfully.');
          } else {
            logger.error('Apply new config ERROR.');
          }
        }

      }
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Create new bot
   * @param userId
   * @param accountId
   * @param token
   * @param chatId
   */
  async createNewBotConfig(userId: string, accountId: string, token: string, chatId: string) {
    try {
      let tradeUser: TradeUser = {
        start: false,
        isRunning: true,
        startTrade: "00:00:00",
        stopTrade: "23:59:59",
        chatId: chatId,
        userId: userId,
        accountId: accountId,
        accountAlias: accountId,
        token: token,
        amountStrategy: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        splitCandleThStrategy: -1,
        splitOffsetStrategy: 0,
        strategyList: ["default_order"],
        strategyRunning: "default_order"
      };

      let tradeUserFromDb: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});

      if (tradeUserFromDb == null) {
        const result: boolean = (await new TradeUserRepo().create(tradeUser));
        if (result) {
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve("Create new bot successfully");
        } else {
          return Promise.resolve("Create new bot error");
        }
      } else {
        tradeUser._id = tradeUserFromDb._id;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, tradeUser);
        if (result) {
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve("Update bot successfully");
        } else {
          return Promise.resolve("Update bot error");
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Create or update strategy
   * @param strategyId
   * @param description
   * @param example
   */
  async upStrategy(strategyId: string, description: string, example: string) {
    try {
      let strategy: Strategy = {
        uid: strategyId,
        description: description,
        example: example
      };

      let strategyFromDb: Strategy | null = await new StrategyRepo().findOne({uid: strategyId});

      if (strategyFromDb == null) {
        const result: boolean = (await new StrategyRepo().create(strategy));
        if (result) {
          // @nhancv 9/14/19: Update config
          this.config.strategyList.push(strategy);
          return Promise.resolve("Create new strategy successfully");
        } else {
          return Promise.resolve("Create new strategy error");
        }
      } else {
        strategy._id = strategyFromDb._id;
        const result: boolean = await new StrategyRepo().update({_id: strategy._id}, strategy);
        if (result) {
          // @nhancv 9/14/19: Update config
          for (let i = 0; i < this.config.strategyList.length; i++) {
            if (this.config.strategyList[i].uid == strategyId) {
              this.config.strategyList[i] = strategy;
              break;
            }
          }
          return Promise.resolve("Update strategy successfully");
        } else {
          return Promise.resolve("Update strategy error");
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Delete strategy
   * @param strategyId
   */
  async downStrategy(strategyId: string) {
    try {
      const defaultOrderId = "default_order";
      if (strategyId == defaultOrderId) {
        return Promise.resolve("Del Strategy: Can not delete default strategy");
      }

      let strategyFromDb: Strategy | null = await new StrategyRepo().findOne({uid: strategyId});

      if (strategyFromDb !== null) {
        // @nhancv 10/19/19: Remove strategy running on user first
        for (let accountId in this.config.tradeUsers) {
          let tradeUser: TradeUser = this.config.tradeUsers[accountId];
          let strategyList = tradeUser.strategyList;
          let findI = strategyList.indexOf(strategyId);
          if (findI !== -1) {
            strategyList.splice(findI, 1);
            tradeUser.strategyList = strategyList;
            // @nhancv 10/19/19: Only clear strategy if current strategy equal which want to delete
            if (tradeUser.strategyRunning == strategyId) {
              tradeUser.strategyRunning = defaultOrderId;
              tradeUser.amountStrategy = [0, 0, 0, 0, 0];
            }
            await new TradeUserRepo().update({accountId: accountId}, {
              strategyList: tradeUser.strategyList,
              strategyRunning: tradeUser.strategyRunning,
              amountStrategy: tradeUser.amountStrategy
            });
          }
        }

        const result: boolean = (await new StrategyRepo().delete({uid: strategyId}));
        if (result) {
          // @nhancv 9/14/19: Update config
          for (let i = 0; i < this.config.strategyList.length; i++) {
            if (this.config.strategyList[i].uid == strategyId) {
              this.config.strategyList.splice(i, 1);
              break;
            }
          }
          return Promise.resolve("Delete strategy successfully");
        } else {
          return Promise.resolve("Delete strategy error");
        }
      } else {
        return Promise.resolve("Strategy does not found");
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Create new user
   * @param userId
   * @param accountId
   * @param userName
   */
  async addUserConfig(userId: string, accountId: string, userName: string) {
    try {
      let user: User | null = await new UserRepo().findOne({accountId: accountId});
      if (user == null) {
        let user: User = {
          userId: userId,
          accountId: accountId,
          userName: userName
        };
        const result: boolean = (await new UserRepo().create(user));
        if (result) {
          // @nhancv 9/14/19: Update config
          if (this.config.helperBot.users) {
            this.config.helperBot.users.push(user);
          }
          return Promise.resolve("Register user successfully");
        } else {
          return Promise.resolve("Register user error");
        }
      } else {
        return Promise.resolve("User has been registered.");
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Update amount strategy
   * @param accountId
   * @param newTradeUserObject
   */
  async setAmountStrategy(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        tradeUser.amountStrategy = newTradeUserObject.amountStrategy;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, tradeUser);
        if (result) {
          logger.info(`${accountId} setAmountStrategy -> ${newTradeUserObject.amountStrategy}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve(`Cập nhật dãy lệnh thành công. Thông số mới là: ${newTradeUserObject.amountStrategy}`);
        } else {
          return Promise.resolve(`Cập nhật dãy lệnh KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Update bot status
   * @param accountId
   * @param newTradeUserObject
   */
  async setBotStatusByUser(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        tradeUser.isRunning = newTradeUserObject.isRunning;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, tradeUser);
        if (result) {
          logger.info(`${accountId} setBotStatusByUser -> ${newTradeUserObject.isRunning}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve(`Bot đã được cập nhật sang trạng thái '${newTradeUserObject.isRunning ? 'Hoạt động' : 'Dừng'}'`);
        } else {
          return Promise.resolve(`Cập nhật trạng thái KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Update root bot status
   * @param accountId
   * @param newTradeUserObject
   */
  async setBotRootStatusByUser(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        tradeUser.start = newTradeUserObject.start;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, tradeUser);
        if (result) {
          logger.info(`${accountId} setBotRootStatusByUser -> ${newTradeUserObject.start}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve(`${accountId} Đã chuyển trang thái sang '${newTradeUserObject.start ? 'Hoạt động' : 'Dừng'}'`);
        } else {
          return Promise.resolve(`${accountId} Cập nhật trạng thái KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Update working time for bot
   * @param accountId
   * @param newTradeUserObject
   */
  async setBotTime(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        tradeUser.startTrade = newTradeUserObject.startTrade;
        tradeUser.stopTrade = newTradeUserObject.stopTrade;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, tradeUser);
        if (result) {
          logger.info(`${accountId} setBotTime -> ${newTradeUserObject.startTrade} - ${newTradeUserObject.stopTrade}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve(`Cập nhật time thành công: ${newTradeUserObject.startTrade} - ${newTradeUserObject.stopTrade}`);
        } else {
          return Promise.resolve(`Cập nhật time KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Update split strategy
   * @param accountId
   * @param newTradeUserObject
   */
  async setSplitStrategy(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        tradeUser.splitCandleThStrategy = newTradeUserObject.splitCandleThStrategy;
        tradeUser.splitOffsetStrategy = newTradeUserObject.splitOffsetStrategy;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, tradeUser);
        if (result) {
          logger.info(`${accountId} setSplitStrategy -> splitCandleThStrategy: ${newTradeUserObject.splitCandleThStrategy} - splitOffsetStrategy: ${newTradeUserObject.splitOffsetStrategy}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = tradeUser;
          return Promise.resolve(`Cập nhật split strategy thành công: ${newTradeUserObject.splitCandleThStrategy} ${newTradeUserObject.splitOffsetStrategy}`);
        } else {
          return Promise.resolve(`Cập nhật split strategy KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Active strategy
   * @param accountId
   * @param newTradeUserObject
   */
  async setStrategyRunning(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        newTradeUserObject._id = tradeUser._id;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, newTradeUserObject);
        if (result) {
          logger.info(`${accountId} setStrategyRunning -> ${newTradeUserObject.strategyRunning}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = newTradeUserObject;
          return Promise.resolve(`Cập nhật setStrategyRunning thành công: ${newTradeUserObject.strategyRunning}`);
        } else {
          return Promise.resolve(`Cập nhật setStrategyRunning KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Update maintenance flag
   * @param active
   */
  async setMaintenanceFlag(active: boolean) {
    try {
      let systems: System[] = await new SystemRepo().getAll();
      if (systems.length > 0) {
        let system = systems[0];
        system.maintenance = active;
        const result: boolean = await new SystemRepo().update({_id: system._id}, system);
        if (result) {
          this.config.maintenance = active;
          return Promise.resolve(`Cập nhật setMaintenanceFlag thành công: ${system.maintenance}`);
        } else {
          return Promise.resolve(`Cập nhật setMaintenanceFlag KHÔNG thành công`);
        }
      } else {
        return Promise.resolve(`Not found`);
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }

  /**
   * Set strategy list
   * @param accountId
   * @param newTradeUserObject
   */
  async setStrategyList(accountId: string, newTradeUserObject: TradeUser) {
    try {
      let tradeUser: TradeUser | null = await new TradeUserRepo().findOne({accountId: accountId});
      if (tradeUser == null) {
        return Promise.resolve("Tài khoản không tồn tại.");
      } else {
        const defaultOrderId = "default_order";
        if (newTradeUserObject.strategyList.indexOf(defaultOrderId) === -1) {
          newTradeUserObject.strategyList.push(defaultOrderId);
        }

        newTradeUserObject._id = tradeUser._id;
        const result: boolean = await new TradeUserRepo().update({_id: tradeUser._id}, newTradeUserObject);
        if (result) {
          logger.info(`${accountId} setStrategyList: ${newTradeUserObject.strategyList}`);
          // @nhancv 9/14/19: Update config
          this.config.tradeUsers[accountId] = newTradeUserObject;
          return Promise.resolve(`Cập nhật setStrategyList thành công: ${newTradeUserObject.strategyList}`);
        } else {
          return Promise.resolve(`Cập nhật setStrategyList KHÔNG thành công`);
        }
      }
    } catch (e) {
      logger.error(e);
      return Promise.resolve("Operation catch error");
    }
  }
}
