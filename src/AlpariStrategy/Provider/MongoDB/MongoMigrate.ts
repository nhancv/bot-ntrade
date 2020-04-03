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

import {MongoProvider} from "./MongoProvider";
import {SystemRepo} from "./Orm/SystemRepo";
import {System, System_TableName} from "../../Model/System";
import {UserRepo} from "./Orm/UserRepo";
import {HelperBotRepo} from "./Orm/HelperBotRepo";
import {PriceBotRepo} from "./Orm/PriceBotRepo";
import {TradeBotRepo} from "./Orm/TradeBotRepo";
import {TradeUserRepo} from "./Orm/TradeUserRepo";
import {FunnyMessage_TableName} from "../../Model/FunnyMessage";
import {FunnyMessageRepo} from "./Orm/FunnyMessageRepo";
import {InitFunnyMessage} from "./InitData/InitFunnyMessage";
import {Collection} from "mongodb";
import {Octopus} from "./InitData/Octopus";
import {User_TableName} from "../../Model/User";
import {HelperBot_TableName} from "../../Model/HelperBot";
import {PriceBot_TableName} from "../../Model/PriceBot";
import {TradeBot_TableName} from "../../Model/TradeBot";
import {TradeUser_TableName} from "../../Model/TradeUser";
import {InitSystem} from "./InitData/InitSystem";
import {InitUser} from "./InitData/InitUser";
import {InitHelperBot} from "./InitData/InitHelperBot";
import {InitPriceBot} from "./InitData/InitPriceBot";
import {InitTradeBot} from "./InitData/InitTradeBot";
import {InitTradeUser} from "./InitData/InitTradeUser";
import {Strategy_TableName} from "../../Model/Strategy";
import {InitStrategy} from "./InitData/InitStrategy";
import {StrategyRepo} from "./Orm/StrategyRepo";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');

// Run on main index.ts
export class MongoMigrate {
  async migrate() {
    try {
      // @nhancv 9/17/19: FILL DATA IF DATABASE IS EMPTY
      let listCols: any[] = await MongoProvider.instance.store.listCollections().toArray();
      // @nhancv 9/17/19: Populate data
      const octopus = new Octopus();
      let tableRequires = [
        System_TableName,
        User_TableName,
        HelperBot_TableName,
        PriceBot_TableName,
        TradeBot_TableName,
        TradeUser_TableName,
        FunnyMessage_TableName,
      ];
      if (listCols.length < tableRequires.length) {
        listCols = listCols.map(value => value.name);
        logger.info('Missing initial database.');
        for (let i = 0; i < tableRequires.length; i++) {
          let tableName = tableRequires[i];
          if (listCols.indexOf(tableName) === -1) {
            logger.info(`Filling ${tableName} collection.`);
            switch (tableName) {
              case System_TableName:
                await octopus.initData(new InitSystem());
                break;
              case User_TableName:
                await octopus.initData(new InitUser());
                break;
              case HelperBot_TableName:
                await octopus.initData(new InitHelperBot());
                break;
              case PriceBot_TableName:
                await octopus.initData(new InitPriceBot());
                break;
              case TradeBot_TableName:
                await octopus.initData(new InitTradeBot());
                break;
              case TradeUser_TableName:
                await octopus.initData(new InitTradeUser());
                break;
              case FunnyMessage_TableName:
                await octopus.initData(new InitFunnyMessage());
                break;
            }
          }
        }
        logger.info('Init Data done!');
      }

      let systemConfigs = await new SystemRepo().getAll();
      let config: System = systemConfigs[0];
      if (config == undefined) {
        // @nhancv 9/22/19: Re-init system config
        await octopus.initData(new InitSystem());
        systemConfigs = await new SystemRepo().getAll();
        config = systemConfigs[0];
      }
      let dbVersion: number = config ? config.hasOwnProperty("dbVersion") ? config.dbVersion : 0 : 0;

      if (dbVersion == 0) {
        logger.info(`Migrating from version ${dbVersion}`);
        // @nhancv 9/16/19: UPDATE USER COLLECTION
        // Replace old _id to ObjectID
        let users = await new UserRepo().getAll();
        if (users.length > 0) {
          users.forEach(v => {
            delete v["_id"];
          });
          // delete all record
          await new UserRepo().deleteMany({});
          await new UserRepo().insertMany(users);
        }

        // @nhancv 9/16/19: UPDATE HELPER_BOT COLLECTION
        // Replace old _id to ObjectID
        let helperBots = await new HelperBotRepo().getAll();
        if (helperBots.length > 0) {
          helperBots.forEach(v => {
            delete v["_id"];
          });
          // delete all record
          await new HelperBotRepo().deleteMany({});
          await new HelperBotRepo().insertMany(helperBots);
        }

        // @nhancv 9/16/19: UPDATE PRICE_BOT COLLECTION
        // Replace old _id to ObjectID
        let priceBots = await new PriceBotRepo().getAll();
        if (priceBots.length > 0) {
          priceBots.forEach(v => {
            delete v["_id"];
          });
          // delete all record
          await new PriceBotRepo().deleteMany({});
          await new PriceBotRepo().insertMany(priceBots);
        }

        // @nhancv 9/16/19: UPDATE TRADE_BOT COLLECTION
        // Replace old _id to ObjectID
        let tradeBots = await new TradeBotRepo().getAll();
        if (tradeBots.length > 0) {
          tradeBots.forEach(v => {
            delete v["_id"];
          });
          // delete all record
          await new TradeBotRepo().deleteMany({});
          await new TradeBotRepo().insertMany(tradeBots);
        }

        // @nhancv 9/16/19: UPDATE TRADE_USER COLLECTION
        // Replace old _id to ObjectID
        let tradeUsers = await new TradeUserRepo().getAll();
        if (tradeUsers.length > 0) {
          tradeUsers.forEach(v => {
            delete v["_id"];
          });
          // delete all record
          await new TradeUserRepo().deleteMany({});
          await new TradeUserRepo().insertMany(tradeUsers);
        }
        // @nhancv 9/16/19: CREATE FUNNY_MESSAGE COLLECTION
        try {
          await MongoProvider.instance.store.createCollection(FunnyMessage_TableName);
          await new FunnyMessageRepo().insertMany(new InitFunnyMessage().getTableData());
        } catch (e) {
          logger.error('CREATE FUNNY_MESSAGE COLLECTION', e);
        }

        // @nhancv 9/16/19: UPDATE SYSTEM COLLECTION
        // Change needReload to needReloadAll
        if (config.hasOwnProperty("needReload")) {
          // Remove old field
          delete config["needReload"];
        }
        // Create default value for others needReload flag
        config.needReloadAll = false;
        config.needReloadUserCol = false;
        config.needReloadHelperBotCol = false;
        config.needReloadPriceBotCol = false;
        config.needReloadTradeBotCol = false;
        config.needReloadTradeUserCol = false;
        config.needReloadFunnyMessageCol = false;
        // Increase dbVersion to 1
        config.dbVersion = 1;
        dbVersion = config.dbVersion;
        // Replace new config object
        await new SystemRepo().replace({_id: config._id}, {$unset: {needReload: false}, $set: config});
        logger.info(`Migrate to version ${config.dbVersion} completely`);
      }

      if (dbVersion == 1) {
        // @nhancv 9/18/19: Config for version 1
        logger.info(`Migrating from version ${dbVersion}`);

        // Update TradeUser config for TigerOrder
        // Add TigerAmount to TradeUser
        // @nhancv 9/16/19: UPDATE TRADE_USER COLLECTION
        // Replace old _id to ObjectID
        let tradeUsers = await new TradeUserRepo().getAll();
        if (tradeUsers.length > 0) {
          tradeUsers.forEach(tradeUser => {
            tradeUser["tigerOrderActive"] = false;
            tradeUser["tigerAmount"] = [0, 0, 0, 0, 0];
            tradeUser["tigerDelayStopLoss"] = 10;
          });
          await new TradeUserRepo().deleteMany({});
          await new TradeUserRepo().insertMany(tradeUsers);
        }

        config.dbVersion = 2;
        dbVersion = config.dbVersion;
        // Replace new config object
        await new SystemRepo().update({_id: config._id}, config);
        logger.info(`Migrate to version ${config.dbVersion} completely`);
      }

      if (dbVersion == 2) {
        // @nhancv 9/18/19: Config for version 1
        logger.info(`Migrating from version ${dbVersion}`);
        // @nhancv 9/21/19: Add maintenance field
        config.maintenance = false;

        config.dbVersion = 3;
        dbVersion = config.dbVersion;
        // Replace new config object
        await new SystemRepo().update({_id: config._id}, config);
        logger.info(`Migrate to version ${config.dbVersion} completely`);
      }

      if (dbVersion == 3) {
        // @nhancv 9/18/19: Config for version 1
        logger.info(`Migrating from version ${dbVersion}`);

        // Remove tiger config
        // Add strategy config
        let tradeUsers = await new TradeUserRepo().getAll();
        if (tradeUsers.length > 0) {
          tradeUsers.forEach(tradeUser => {
            delete tradeUser["tigerOrderActive"];
            delete tradeUser["tigerAmount"];
            delete tradeUser["tigerDelayStopLoss"];

            tradeUser["strategyList"] = ["default_order"];
            tradeUser["strategyRunning"] = "default_order";
          });
          await new TradeUserRepo().deleteMany({});
          await new TradeUserRepo().insertMany(tradeUsers);
        }

        // @nhancv 9/16/19: CREATE FUNNY_MESSAGE COLLECTION
        try {
          await MongoProvider.instance.store.createCollection(Strategy_TableName);
          await new StrategyRepo().insertMany(new InitStrategy().getTableData());
        } catch (e) {
          logger.error('CREATE STRATEGY COLLECTION', e);
        }

        // @nhancv 10/15/19: Add needReloadStrategyCol variable
        config.needReloadStrategyCol = false;

        //--------------------
        config.dbVersion = 4;
        dbVersion = config.dbVersion;
        // Replace new config object
        await new SystemRepo().update({_id: config._id}, config);
        logger.info(`Migrate to version ${config.dbVersion} completely`);
      }

    } catch
      (e) {
      logger.error(e);
    }
  }
}
