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
import Telegraf, {Extra, Markup} from 'telegraf'
import LifeCycle from "../Utils/LifeCycle";
import moment from "moment";
import {ConfigEnv} from "../Model/ConfigEnv";
import {TradeUser} from "../Model/TradeUser";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');

const USER_NOT_REGISTER_YET_MSG = 'Bạn chưa được đăng ký trên hệ thống.';
const INPUT_WRONG_FORMAT_MSG = 'Bạn đã nhập sai cú pháp.';
const NOT_FOUND_MSG = 'Không tìm thấy';

// @nhancv 2019-09-12: Bot action for keyboard
const ACTION = {
  CHATID: {text: "Lấy id chat", id: "CHAT_ID_ACTION"},
  TOKEN: {text: "Lấy token info", id: "TOKEN_ACTION"},
  ADD_USER: {text: "Đăng ký user", id: "ADD_USER_ACTION"},
  ADD_BOT: {text: "Thêm bot", id: "ADD_BOT_ACTION"},
  ROOT_START_BOT: {text: "Root Start bot", id: "ROOT_START_BOT_ACTION"},
  ROOT_STOP_BOT: {text: "Root Stop bot", id: "ROOT_STOP_BOT_ACTION"},
  EDIT_TIME: {text: "Edit time", id: "EDIT_TIME_ACTION"},
  SPLIT_CANDLES: {text: "Split candles", id: "SPLIT_CANDLES_ACTION"},
  ANNOUNCEMENT: {text: "Announcement", id: "ANNOUNCEMENT_ACTION"},
  MAINTENANCE: {text: "Maintenance", id: "MAINTENANCE_ACTION"},
  SYS_UP_STRATEGY: {text: "Up Strategy", id: "SYS_UP_STRATEGY_ACTION"},
  SYS_DOWN_STRATEGY: {text: "Down Strategy", id: "SYS_DOWN_STRATEGY_ACTION"},
  USER_CLEAR_ORDER_CACHE: {text: "Clear order cache", id: "USER_CLEAR_ORDER_CACHE_ACTION"},
  USER_REGISTER_ORDERID: {text: "Add orderId", id: "USER_REGISTER_ORDERID_ACTION"},
  USER_REMOVE_ORDERID: {text: "Del orderId", id: "USER_REMOVE_ORDERID_ACTION"},
  USER_RESET_ORDERID_LIST: {text: "Reset OrderIds", id: "USER_RESET_ORDERID_LIST_ACTION"},
  USER_ACTIVE_ORDERID: {text: "Active orderId", id: "USER_ACTIVE_ORDERID_ACTION"},
  GET_STRATEGY_LIST: {text: "Ds Strategy", id: "GET_STRATEGY_LIST_ACTION"},
  VERIFY_USER: {text: "Xác thực TK", id: "VERIFY_USER_ACTION"},
  START_BOT: {text: "Start bot", id: "START_BOT_ACTION"},
  STOP_BOT: {text: "Stop bot", id: "STOP_BOT_ACTION"},
  EDIT_AMOUNT: {text: "Cập nhật lệnh", id: "EDIT_AMOUNT_ACTION"},
  STATUS_BOT: {text: "Trạng thái bot", id: "STATUS_BOT_ACTION"},
  CANCEL: {text: "Đóng yêu cầu", id: "CANCEL_ACTION"},
};

/**
 * This bot for agent
 */
export default class AgentBot implements LifeCycle {
  bot: any;
  config: ConfigEnv;
  // @nhancv 2019-09-12: Save last command of user by fromId
  command: any = {};
  // @nhancv 2019-09-12: Save last data in command of user by fromId
  commandData: any = {};

  notifyOnMaintenance: (active: boolean) => Promise<string> = () => Promise.resolve('');
  notifyOnRetrieveToken: (accountId: string, password: string) => Promise<string> = () => Promise.resolve('');
  notifyOnAddUser: (userId: string, accountId: string, userName: string) => Promise<string> = () => Promise.resolve('');
  notifyOnAddBot: (userId: string, accountId: string, password: string, chatId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnRootStartBot: (accountId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnRootStopBot: (accountId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnEditTime: (accountId: string, startTime: string, endTime: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnSplitCandles: (accountId: string, splitCandleThStrategy: number, splitOffsetStrategy: number) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnVerifyUser: (userId: string, accountId: string, password: string, chatId: string) => Promise<string> = () => Promise.resolve('');
  notifyOnUpStrategy: (strategyId: string, description: string, example: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnDownStrategy: (strategyId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnStartBot: (accountId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnStopBot: (accountId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnStartBotByUser: (accountId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnStopBotByUser: (accountId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnEditAmount: (accountId: string, amount: number[]) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnEditAmountByUser: (accountId: string, amount: number[]) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnUserClearOrderCache: (accountId: string, strategyId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnUserRegisterOrderId: (accountId: string, strategyId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnUserRemoveOrderId: (accountId: string, strategyId: string) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnUserResetOrderIdList: (accountId: string, strategyList: string[]) => Promise<string> = () => Promise.resolve('Ok');
  notifyOnUserActiveOrderId: (accountId: string, strategyId: string) => Promise<string> = () => Promise.resolve('Ok');

  // @nhancv 2019-09-12: Menu
  adminMenu = Extra
    .markdown()
    .markup((m) => m.inlineKeyboard([
      m.callbackButton(ACTION.CHATID.text, ACTION.CHATID.id),
      m.callbackButton(ACTION.TOKEN.text, ACTION.TOKEN.id),
      m.callbackButton(ACTION.ADD_BOT.text, ACTION.ADD_BOT.id),
      m.callbackButton(ACTION.EDIT_TIME.text, ACTION.EDIT_TIME.id),
      m.callbackButton(ACTION.SPLIT_CANDLES.text, ACTION.SPLIT_CANDLES.id),
      m.callbackButton(ACTION.SYS_UP_STRATEGY.text, ACTION.SYS_UP_STRATEGY.id),
      m.callbackButton(ACTION.SYS_DOWN_STRATEGY.text, ACTION.SYS_DOWN_STRATEGY.id),
      m.callbackButton(ACTION.ANNOUNCEMENT.text, ACTION.ANNOUNCEMENT.id),
      m.callbackButton(ACTION.MAINTENANCE.text, ACTION.MAINTENANCE.id),
      m.callbackButton(ACTION.ADD_USER.text, ACTION.ADD_USER.id),
      m.callbackButton(ACTION.ROOT_START_BOT.text, ACTION.ROOT_START_BOT.id),
      m.callbackButton(ACTION.ROOT_STOP_BOT.text, ACTION.ROOT_STOP_BOT.id),
      m.callbackButton(ACTION.USER_CLEAR_ORDER_CACHE.text, ACTION.USER_CLEAR_ORDER_CACHE.id),
      m.callbackButton(ACTION.USER_REGISTER_ORDERID.text, ACTION.USER_REGISTER_ORDERID.id),
      m.callbackButton(ACTION.USER_REMOVE_ORDERID.text, ACTION.USER_REMOVE_ORDERID.id),
      m.callbackButton(ACTION.USER_RESET_ORDERID_LIST.text, ACTION.USER_RESET_ORDERID_LIST.id),
      m.callbackButton(ACTION.USER_ACTIVE_ORDERID.text, ACTION.USER_ACTIVE_ORDERID.id),
      m.callbackButton(ACTION.GET_STRATEGY_LIST.text, ACTION.GET_STRATEGY_LIST.id),
      m.callbackButton(ACTION.VERIFY_USER.text, ACTION.VERIFY_USER.id),
      m.callbackButton(ACTION.START_BOT.text, ACTION.START_BOT.id),
      m.callbackButton(ACTION.STOP_BOT.text, ACTION.STOP_BOT.id),
      m.callbackButton(ACTION.EDIT_AMOUNT.text, ACTION.EDIT_AMOUNT.id),
      m.callbackButton(ACTION.STATUS_BOT.text, ACTION.STATUS_BOT.id),
      m.callbackButton(ACTION.CANCEL.text, ACTION.CANCEL.id),
    ], {columns: 2}).resize());

  userUnVerifiedMenu = Extra
    .markdown()
    .markup((m) => m.inlineKeyboard([
      m.callbackButton(ACTION.VERIFY_USER.text, ACTION.VERIFY_USER.id),
      m.callbackButton(ACTION.CANCEL.text, ACTION.CANCEL.id),
    ], {columns: 3}).resize());

  userVerifiedMenu = Extra
    .markdown()
    .markup((m) => m.inlineKeyboard([
      m.callbackButton(ACTION.VERIFY_USER.text, ACTION.VERIFY_USER.id),
      m.callbackButton(ACTION.GET_STRATEGY_LIST.text, ACTION.GET_STRATEGY_LIST.id),
      m.callbackButton(ACTION.USER_ACTIVE_ORDERID.text, ACTION.USER_ACTIVE_ORDERID.id),
      m.callbackButton(ACTION.START_BOT.text, ACTION.START_BOT.id),
      m.callbackButton(ACTION.STOP_BOT.text, ACTION.STOP_BOT.id),
      m.callbackButton(ACTION.EDIT_AMOUNT.text, ACTION.EDIT_AMOUNT.id),
      m.callbackButton(ACTION.STATUS_BOT.text, ACTION.STATUS_BOT.id),
      m.callbackButton(ACTION.CANCEL.text, ACTION.CANCEL.id),
    ], {columns: 3}).resize());

  cancelMenu = Extra
    .markdown()
    .markup((m) => m.inlineKeyboard([
      m.callbackButton(ACTION.CANCEL.text, ACTION.CANCEL.id),
    ], {columns: 3}).resize());

  constructor(config: any) {
    this.config = config;
  }

  async onCreate() {
    try {
      this.bot = new Telegraf(this.config.helperBot.token);
      this.bot.telegram.getMe().then((botInfo) => {
        this.bot.options.username = botInfo.username
      });
      //middleware
      this.bot.use((ctx, next) => {
        if (ctx.updateType == 'callback_query') return next(ctx);
        else if (ctx.updateType == 'message') {
          if (this.isAdmin(String(ctx.message.from.id)) || this.isUserNames(ctx.message.from.username))
            return next(ctx);
        }
      });
      this.bot.start((ctx) => ctx.reply(`Xin chào ${ctx.message.from.first_name} ${ctx.message.from.last_name}\n Gõ /help để được hướng dẫn chi tiết nhé.`));
      this.bot.help(async (ctx) => {
        try {
          await ctx.deleteMessage();
          let msg = `Hi ${ctx.message.from.first_name} ${ctx.message.from.last_name},\nHãy chọn chức năng bạn cần bên dưới nhé.`;
          if (this.isAdmin(String(ctx.message.from.id))) {
            await ctx.reply(msg, this.adminMenu);
          } else if (this.isUserNames(ctx.message.from.username)) {
            let username = ctx.message.from.username;
            let validUsers = this.config.helperBot.users ? this.config.helperBot.users.filter((s) => {
              return (s && s.userName == username);
            }) : [];
            if (validUsers.length > 0) {
              let chatId = String(ctx.message.chat.id);
              let notfound: boolean = true;
              for (let i = 0; i < validUsers.length; i++) {
                let user = validUsers[i];
                if (this.config.tradeUsers.hasOwnProperty(user.accountId) &&
                  this.config.tradeUsers[user.accountId].chatId == chatId) {
                  notfound = false;
                  break;
                }
              }
              if (notfound) {
                await ctx.reply(msg, this.userUnVerifiedMenu);
              } else {
                await ctx.reply(msg, this.userVerifiedMenu);
              }
            }
          }
        } catch (e) {
          logger.error(e);
        }
      });
      // @nhancv 2019-09-12: ACTION
      this.bot.action(ACTION.CHATID.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.getChatId(fromId, ctx, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.TOKEN.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.getUserToken(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.ADD_USER.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.addUser(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.ADD_BOT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.addBot(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.ANNOUNCEMENT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.announcement(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.MAINTENANCE.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.maintenance(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.ROOT_START_BOT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.rootStartBot(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.ROOT_STOP_BOT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.rootStopBot(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.EDIT_TIME.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.editTime(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.SPLIT_CANDLES.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.editSplitCandles(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.USER_RESET_ORDERID_LIST.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.userResetOrderIdList(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.USER_ACTIVE_ORDERID.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.userActiveOrderId(fromId, ctx, username, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.USER_CLEAR_ORDER_CACHE.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.userClearOrderCache(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.USER_REGISTER_ORDERID.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.userRegisterOrderId(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.USER_REMOVE_ORDERID.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.userRemoveOrderId(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.SYS_UP_STRATEGY.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.sysUpStrategy(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.SYS_DOWN_STRATEGY.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          await this.sysDownStrategy(fromId, ctx);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.VERIFY_USER.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          await this.verifyUser(fromId, ctx, username);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.START_BOT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.startBot(fromId, ctx, username, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.STOP_BOT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.stopBot(fromId, ctx, username, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.EDIT_AMOUNT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.editAmount(fromId, ctx, username, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.STATUS_BOT.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.statusBot(fromId, ctx, username, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.GET_STRATEGY_LIST.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);

          let fromId = String(ctx.update.callback_query.from.id);
          let username = ctx.update.callback_query.from.username;
          let chatId = String(ctx.update.callback_query.message.chat.id);
          await this.getStrategyList(fromId, ctx, username, chatId);
        } catch (e) {
          logger.error(e);
        }
      });
      this.bot.action(ACTION.CANCEL.id, async (ctx) => {
        try {
          let msg = ctx.update.callback_query.message;
          await ctx.answerCbQuery('ok', false);
          await ctx.deleteMessage(msg.message_id);

          let fromId = String(ctx.update.callback_query.from.id);
          this.resetCommand(fromId);
        } catch (e) {
          logger.error(e);
        }
      });

      // @nhancv 2019-08-31: Listen all text
      this.bot.on('text', async (ctx) => {
          try {
            let fromId = String(ctx.message.from.id);
            let isAdmin: boolean = false;
            switch (this.command[fromId]) {
              case ACTION.TOKEN.id:
                await this.onTextTokenAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.MAINTENANCE.id:
                await this.onTextMaintenanceAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.ADD_USER.id:
                await this.onTextAddUserAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.ADD_BOT.id:
                await this.onTextAddBotAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.ROOT_START_BOT.id:
                await this.onTextRootStartBotAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.ROOT_STOP_BOT.id:
                await this.onTextRootStopBotAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.ANNOUNCEMENT.id:
                await this.onTextAnnouncementAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.EDIT_TIME.id:
                await this.onTextEditTime(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.SPLIT_CANDLES.id:
                await this.onTextEditSplitCandles(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.VERIFY_USER.id:
                await this.onTextVerifyUserAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.USER_RESET_ORDERID_LIST.id:
                await this.onTextUserResetOrderIdListAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.USER_ACTIVE_ORDERID.id:
                isAdmin = this.commandData[fromId].isAdmin;
                if (isAdmin) {
                  await this.onTextUserActiveOrderIdActionByAdmin(ctx);
                  this.resetCommand(fromId);
                } else {
                  let isFinalStep: boolean = this.commandData[fromId].isFinalStep;
                  if (!isFinalStep) {
                    let accountId = ctx.message.text.trim();
                    await this.onTextUserActiveOrderIdInputStep(fromId, accountId, ctx);
                  } else {
                    let accountId: string = this.commandData[fromId].accountId;
                    await this.onTextUserActiveOrderIdActionByUser(ctx, accountId);
                    this.resetCommand(fromId);
                  }
                }
                break;
              case ACTION.USER_REGISTER_ORDERID.id:
                await this.onTextUserRegisterOrderIdAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.USER_CLEAR_ORDER_CACHE.id:
                await this.onTextUserClearOrderCacheAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.SYS_UP_STRATEGY.id:
                await this.onTextSysUpStrategyAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.SYS_DOWN_STRATEGY.id:
                await this.onTextSysDownStrategyAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.USER_REMOVE_ORDERID.id:
                await this.onTextUserRemoveOrderIdAction(ctx);
                this.resetCommand(fromId);
                break;
              case ACTION.START_BOT.id:
                isAdmin = this.commandData[fromId].isAdmin;
                if (isAdmin) {
                  await this.onTextStartBotAdminAction(ctx);
                } else {
                  await this.onTextStartBotUserAction(ctx);
                }
                this.resetCommand(fromId);
                break;
              case ACTION.STOP_BOT.id:
                isAdmin = this.commandData[fromId].isAdmin;
                if (isAdmin) {
                  await this.onTextStopBotAdminAction(ctx);
                } else {
                  await this.onTextStopBotUserAction(ctx);
                }
                this.resetCommand(fromId);
                break;
              case ACTION.EDIT_AMOUNT.id:
                isAdmin = this.commandData[fromId].isAdmin;
                if (isAdmin) {
                  await this.onTextEditAmountAdminAction(ctx);
                  this.resetCommand(fromId);
                } else {
                  let isFinalStep: boolean = this.commandData[fromId].isFinalStep;
                  if (!isFinalStep) {
                    let accountId = ctx.message.text.trim();
                    await this.onTextEditAmountUserInputStep(fromId, accountId, ctx);
                  } else {
                    let accountId: string = this.commandData[fromId].accountId;
                    await this.onTextEditAmountUserAction(ctx, accountId);
                    this.resetCommand(fromId);
                  }
                }
                break;
              case ACTION.STATUS_BOT.id:
                await this.onTextStatusBotAction(ctx);
                this.resetCommand(fromId);
                break;
              default:
                await ctx.reply('🥰', {reply_markup: {remove_keyboard: true}});
                this.resetCommand(fromId);
                break;
            }
          } catch (e) {
            logger.error(e);
          }
        }
      );
    } catch (e) {
      logger.error(e);
    }
  }

  private resetCommand(fromId) {
    this.command[fromId] = null;
    this.commandData[fromId] = null;
  }

  private async onTextEditAmountUserInputStep(fromId, accountId, ctx) {
    try {
      this.command[fromId] = ACTION.EDIT_AMOUNT.id;
      this.commandData[fromId] = {isAdmin: false, isFinalStep: true, accountId: accountId};

      let currentStrategyId = this.config.tradeUsers[accountId].strategyRunning;
      let currentStrategy = this.config.strategyList.filter(s => s.uid == currentStrategyId)[0];

      await ctx.reply("Hãy nhập dãy lệnh của bạn, mỗi số cách nhau bởi khoảng trắng.\n" +
        `Chiến lược hiện tại: ${currentStrategyId.replace("_", "\\_")}\n` +
        `Ý nghĩa: ${currentStrategy.description}\n` +
        `Ví dụ: ${currentStrategy.example}\n` +
        `Cấu hình hiện tại: ${this.config.tradeUsers[accountId]["amountStrategy"]}`,
        this.cancelMenu);
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserActiveOrderIdInputStep(fromId, accountId, ctx) {
    try {

      let currentStrategyId = this.config.tradeUsers[accountId].strategyRunning;
      let keyboards: string[] = this.config.tradeUsers[accountId].strategyList.filter(id => id != currentStrategyId);

      if (keyboards.length === 0) {
        await ctx.reply("Bạn chỉ có một chiến lược mà thôi. Để xem danh sách chiến lược chọn \"Ds Strategy\" và liên hệ admin để đăng ký.");
        this.resetCommand(fromId);
      } else {
        this.command[fromId] = ACTION.USER_ACTIVE_ORDERID.id;
        this.commandData[fromId] = {isAdmin: false, isFinalStep: true, accountId: accountId};
        await ctx.reply("Chọn chiến lược bạn muốn kích hoạt.\n" +
          `Chiến lược hiện tại: ${currentStrategyId.replace("_", "\_")}`,
          Markup
            .keyboard(keyboards, {columns: 2})
            .oneTime()
            .resize()
            .removeKeyboard(true)
            .extra());
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextTokenAction(ctx: any) {
    try {
      let text = ctx.message.text;
      // Delete current message in current chat
      await ctx.deleteMessage();
      // Extract input info
      let arr = text.split(" ").filter((s) => s && s.length > 2);
      if (arr.length === 2) {
        let accId = arr[0];
        let pwd = arr[1];
        let result = await this.notifyOnRetrieveToken(accId, pwd);
        if (result && result.length > 0) {
          await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
        } else {
          await ctx.reply(`Token error: ${result}`, {reply_markup: {remove_keyboard: true}});
        }
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextAddUserAction(ctx: any) {
    try {
      let text = ctx.message.text;
      // Extract input info
      let arr = text.split(" ").filter((s) => s && s.length > 2);
      if (arr.length === 3) {
        // userId accountId telegramUsername
        let userId = arr[0];
        let accId = arr[1];
        let telegram = arr[2];
        let result = await this.notifyOnAddUser(userId, accId, telegram);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextAddBotAction(ctx: any) {
    try {
      let text = ctx.message.text;
      // Delete current message in current chat
      await ctx.deleteMessage();
      // Extract input info
      // userId accountId password
      let arr = text.split(" ").filter((s) => s && s.length > 2);
      if (arr.length === 3) {
        let userId = arr[0];
        let accId = arr[1];
        let pwd = arr[2];
        // Add bot
        let result: string = await this.notifyOnAddBot(userId, accId, pwd, String(ctx.message.chat.id));
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextRootStartBotAction(ctx) {
    try {
      let accountId = ctx.message.text.trim();
      // Extract input info
      if (accountId === "all" || this.config.tradeUsers.hasOwnProperty(accountId)) {
        let result: string = await this.notifyOnRootStartBot(accountId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextAnnouncementAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      let dupId = {};
      for (let accountId in this.config.tradeUsers) {
        if (this.config.tradeUsers.hasOwnProperty(accountId)) {
          let tradeUser: TradeUser = this.config.tradeUsers[accountId];
          if (tradeUser.start && !dupId.hasOwnProperty(tradeUser.chatId)) {
            dupId[tradeUser.chatId] = true;
            this.sendMessage(tradeUser.chatId, text);
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextRootStopBotAction(ctx) {
    try {
      let accountId = ctx.message.text.trim();
      // Extract input info
      if (accountId === "all" || this.config.tradeUsers.hasOwnProperty(accountId)) {
        let result: string = await this.notifyOnRootStopBot(accountId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextEditTime(ctx) {
    try {
      let text = ctx.message.text.trim();
      // Extract input info
      // accountId startTime endTime
      let arr = text.split(" ").filter((s) => s && s.length > 2);
      if (arr.length === 3) {
        let accId = arr[0];
        let startTime = arr[1];
        let endTime = arr[2];
        if (moment(startTime, "HH:mm:ss").isValid() &&
          moment(endTime, "HH:mm:ss").isValid()) {
          // Add bot
          let result: string = await this.notifyOnEditTime(accId, startTime, endTime);
          await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
        } else {
          await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
        }
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextEditSplitCandles(ctx) {
    try {
      let text = ctx.message.text.trim();
      // Extract input info
      // accountId splitCandleThStrategy splitOffsetStrategy
      let arr = text.split(" ");
      if (arr.length === 3) {
        let accId = arr[0];
        let splitCandleThStrategy = parseInt(arr[1]);
        let splitOffsetStrategy = parseInt(arr[2]);
        let result: string = await this.notifyOnSplitCandles(accId, splitCandleThStrategy, splitOffsetStrategy);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserActiveOrderIdActionByAdmin(ctx) {
    try {
      let text = ctx.message.text.trim();
      // Extract input info
      // accountId strategyId
      let arr = text.split(" ");
      if (arr.length === 2) {
        let accountId = arr[0];
        let strategyId = arr[1];
        if (this.config.tradeUsers[accountId].strategyList.indexOf(strategyId) === -1) {
          await ctx.reply('Strategy không hợp lệ', {reply_markup: {remove_keyboard: true}});
        } else {
          let result: string = await this.notifyOnUserActiveOrderId(accountId, strategyId);
          await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
        }
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserActiveOrderIdActionByUser(ctx, accountId) {
    try {
      let text = ctx.message.text.trim();
      let strategyId = text.trim();
      if (this.config.tradeUsers[accountId].strategyList.indexOf(strategyId) === -1) {
        await ctx.reply('Strategy không hợp lệ', {reply_markup: {remove_keyboard: true}});
      } else {
        let result: string = await this.notifyOnUserActiveOrderId(accountId, strategyId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserRegisterOrderIdAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      // Extract input info
      // accountId strategyId
      let arr = text.split(" ");
      if (arr.length === 2) {
        let accId = arr[0];
        let strategyId = arr[1];
        if (this.config.strategyList.map(s => s.uid).indexOf(strategyId) === -1) {
          await ctx.reply('Strategy không hợp lệ', {reply_markup: {remove_keyboard: true}});
        } else {
          let result: string = await this.notifyOnUserRegisterOrderId(accId, strategyId);
          await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
        }
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserClearOrderCacheAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      // Extract input info
      // accountId strategyId
      let arr = text.split(" ");
      if (arr.length === 2) {
        let accId = arr[0];
        let strategyId = arr[1];
        if (this.config.strategyList.map(s => s.uid).indexOf(strategyId) === -1) {
          await ctx.reply('Strategy không hợp lệ', {reply_markup: {remove_keyboard: true}});
        } else {
          let result: string = await this.notifyOnUserClearOrderCache(accId, strategyId);
          await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
        }
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextSysUpStrategyAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      // strategyId
      // description
      // example
      let arr = text.split('\n');
      if (arr.length === 3) {
        let strategyId = arr[0];
        let description = arr[1];
        let example = arr[2];

        let result: string = await this.notifyOnUpStrategy(strategyId, description, example);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});

      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextSysDownStrategyAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      let strategyId = text.trim();
      if (this.config.strategyList.map(s => s.uid).indexOf(strategyId) === -1) {
        await ctx.reply('Strategy không hợp lệ', {reply_markup: {remove_keyboard: true}});
      } else {
        let result: string = await this.notifyOnDownStrategy(strategyId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserRemoveOrderIdAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      // Extract input info
      // accountId strategyId
      let arr = text.split(" ");
      if (arr.length === 2) {
        let accId = arr[0];
        let strategyId = arr[1];
        let result: string = await this.notifyOnUserRemoveOrderId(accId, strategyId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextVerifyUserAction(ctx: any) {
    try {
      let text = ctx.message.text;
      // Delete current message in current chat
      await ctx.deleteMessage();
      // Extract input info
      // accountId password
      let arr = text.split(" ").filter((s) => s && s.length > 2);
      if (arr.length === 2) {
        let username = ctx.message.from.username;
        let accId = arr[0];
        let pwd = arr[1];
        let user = this.getUserByUsername(username, accId);
        if (user === null) {
          await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
        } else {
          let result = await this.notifyOnVerifyUser(user.userId, accId, pwd, String(ctx.message.chat.id));
          await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
          this.sendMessageToAdmins(`[${user.userId}-${arr[0]}-${username}]: ${result}`);
        }
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextStartBotAdminAction(ctx) {
    try {
      let accountId = ctx.message.text.trim();
      // Extract input info
      if (accountId === "all" || this.config.tradeUsers.hasOwnProperty(accountId)) {
        let result: string = await this.notifyOnStartBot(accountId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextMaintenanceAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      // 1: true, 0: false
      if (text !== '0' || text !== '1') {
        let active = !!parseInt(text);
        let result: string = await this.notifyOnMaintenance(active);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextStartBotUserAction(ctx) {
    try {
      let chatId = String(ctx.message.chat.id);
      let accountId = ctx.message.text.trim();
      if (this.config.tradeUsers[accountId].chatId == chatId) {
        let result: string = await this.notifyOnStartBotByUser(accountId);
        await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextStopBotAdminAction(ctx) {
    try {
      let accountId = ctx.message.text.trim();
      // Extract input info
      if (accountId === "all" || this.config.tradeUsers.hasOwnProperty(accountId)) {
        let result: string = await this.notifyOnStopBot(accountId);
        await ctx.reply(`${result}`, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextStopBotUserAction(ctx) {
    try {
      let chatId = String(ctx.message.chat.id);
      let accountId = ctx.message.text.trim();
      if (this.config.tradeUsers[accountId].chatId == chatId) {
        let result: string = await this.notifyOnStopBotByUser(accountId);
        await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextEditAmountAdminAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      let inputArr = text.split(" ");
      if (inputArr.length > 1) {
        let accountId = inputArr [0];
        inputArr.splice(0, 1);
        inputArr = inputArr.map(s => {
          let x = parseInt(s);
          return isNaN(x) ? 0 : x;
        });
        let result: string = await this.notifyOnEditAmount(accountId, inputArr);
        await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextUserResetOrderIdListAction(ctx) {
    try {
      let text = ctx.message.text.trim();
      let inputArr = text.split(" ");
      if (inputArr.length > 1) {
        let accountId = inputArr [0];
        inputArr.splice(0, 1);
        let strategyMap = {};
        inputArr = inputArr.filter(strategyId => {
          if (this.config.strategyList.map(s => s.uid).indexOf(strategyId) !== -1 && !strategyMap.hasOwnProperty(strategyId)) {
            strategyMap[strategyId] = true;
            return true;
          }
          return false;
        });
        let result: string = await this.notifyOnUserResetOrderIdList(accountId, inputArr);
        await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextEditAmountUserAction(ctx, accountId) {
    try {
      let text = ctx.message.text.trim();
      let inputArr = text.split(" ").map(s => {
        let x = parseInt(s);
        return isNaN(x) ? 0 : x;
      });
      if (inputArr.length > 0) {
        let result: string = await this.notifyOnEditAmountByUser(accountId, inputArr);
        await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
      } else {
        await ctx.reply(INPUT_WRONG_FORMAT_MSG, {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async onTextStatusBotAction(ctx) {
    try {
      let accountId = ctx.message.text.trim();
      if (accountId === "all" || this.config.tradeUsers.hasOwnProperty(accountId)) {
        if (accountId === "all") {
          let msg = '';
          for (let id in this.config.tradeUsers) {
            if (this.config.tradeUsers.hasOwnProperty(id)) {
              let isRunning = this.config.tradeUsers[id]["isRunning"]
                && this.config.tradeUsers[id]["start"];
              msg += `Bot ${id} đang '${isRunning ? 'Hoạt động' : 'Dừng'}'\n`;
              msg += `-> Thời gian vào lệnh: ${this.config.tradeUsers[id]["startTrade"]}-${this.config.tradeUsers[id]["stopTrade"]}\n`;
            }
          }
          await ctx.reply(msg, {reply_markup: {remove_keyboard: true}});
        } else {
          let isRunning = this.config.tradeUsers[accountId]["isRunning"]
            && this.config.tradeUsers[accountId]["start"];
          let msg = `Bot ${accountId} đang '${isRunning ? 'Hoạt động' : 'Dừng'}'\n`
            + `-> Thời gian vào lệnh: ${this.config.tradeUsers[accountId]["startTrade"]}-${this.config.tradeUsers[accountId]["stopTrade"]}`;
          await ctx.reply(msg, {reply_markup: {remove_keyboard: true}});
        }
      } else {
        await ctx.reply(`${NOT_FOUND_MSG} bot ${accountId}`,
          {reply_markup: {remove_keyboard: true}});
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async statusBot(fromId, ctx, username, chatId) {
    try {
      if (!this.isAdmin(fromId) && !this.isUserNames(username)) return;
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.STATUS_BOT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId hoặc all",
          this.cancelMenu);
      } else if (this.isUserNames(username)) {
        let validBot = this.filterBotByUsername(username);
        if (validBot.length === 0) {
          await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
        } else {
          // If only user has only one accountId, go directly
          let msg = '';
          for (let i = 0; i < validBot.length; i++) {
            let accountId = validBot[i].accountId;
            let isRunning = this.config.tradeUsers[accountId]["isRunning"]
              && this.config.tradeUsers[accountId]["start"];
            msg += `Bot ${accountId} đang '${isRunning ? 'Hoạt động' : 'Dừng'}'\n`
              + `-> Thời gian vào lệnh: ${this.config.tradeUsers[accountId]["startTrade"]}-${this.config.tradeUsers[accountId]["stopTrade"]}\n`;
          }
          if (msg != '') {
            await ctx.reply(msg, {reply_markup: {remove_keyboard: true}});
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async getStrategyList(fromId, ctx, username, chatId) {
    try {
      if (!this.isAdmin(fromId) && !this.isUserNames(username)) return;

      let validBot = this.filterBotByUsername(username);
      if (!this.isAdmin(fromId) && validBot.length === 0) {
        await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
      } else {
        // If only user has only one accountId, go directly
        let msg = '';
        this.config.strategyList.forEach((strategy) => {
          msg += `Chiến lược: ${strategy.uid}\n` +
            `Ý nghĩa: ${strategy.description}\n` +
            `Ví dụ: ${strategy.example}\n` +
            '--------------------------\n';
        });
        if (msg != '') {
          await ctx.reply(msg, {reply_markup: {remove_keyboard: true}});
        }
      }

    } catch (e) {
      logger.error(e);
    }
  }

  private filterBotByUsername(username) {
    return this.config.helperBot.users ? this.config.helperBot.users.filter((s) => {
      return (s && s.accountId && s.userName == username && this.config.tradeUsers.hasOwnProperty(s.accountId));
    }) : [];
  }

  private async editAmount(fromId, ctx, username, chatId) {
    try {
      if (!this.isAdmin(fromId) && !this.isUserNames(username)) return;

      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.EDIT_AMOUNT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId dãy lệnh, mỗi số cách nhau bởi khoảng trắng.\n" +
          "Ví dụ:\n" +
          "L123456 0 0 0 0 1 2 4 0 0 27",
          this.cancelMenu);
      } else if (this.isUserNames(username)) {
        let validBot = this.filterBotByUsername(username);

        if (validBot.length === 0) {
          await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
        } else {
          // If only user has only one accountId, go directly
          if (validBot.length === 1) {
            let accountId = validBot[0].accountId;
            await this.onTextEditAmountUserInputStep(fromId, accountId, ctx);
          } else {
            this.command[fromId] = ACTION.EDIT_AMOUNT.id;
            this.commandData[fromId] = {isAdmin: false, isFinalStep: false};
            // Otherwise, more than 1 accountId, show Keyboard
            // If more than 1 accountId show keyboard
            let accKeyboards: string[] = validBot.map(s => s.accountId);
            await ctx.reply('Chọn bot theo danh sách bên dưới.', Markup
              .keyboard(accKeyboards, {columns: 2})
              .oneTime()
              .resize()
              .removeKeyboard(true)
              .extra());
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async userResetOrderIdList(fromId, ctx) {
    try {
      if (!this.isAdmin(fromId)) return;

      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.USER_RESET_ORDERID_LIST.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId dãy strategy id.\n" +
          "Ví dụ:\n" +
          "L123456 tiger\\_order\n",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async stopBot(fromId, ctx, username, chatId) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.STOP_BOT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId hoặc all",
          this.cancelMenu);
      } else if (this.isUserNames(username)) {
        // Stop by user
        let validBot = this.filterBotByUsername(username);

        if (validBot.length === 0) {
          await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
        } else {
          // If only user has only one accountId, go directly
          if (validBot.length === 1) {
            let user = validBot[0];
            if (this.config.tradeUsers[user.accountId].chatId == chatId) {
              let result: string = await this.notifyOnStopBotByUser(user.accountId);
              await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
            }
          } else {
            this.command[fromId] = ACTION.STOP_BOT.id;
            this.commandData[fromId] = {isAdmin: false};
            // Otherwise, more than 1 accountId, show Keyboard
            // If more than 1 accountId show keyboard
            let accKeyboards: string[] = validBot.map(s => s.accountId);
            await ctx.reply('Chọn bot theo danh sách bên dưới.', Markup
              .keyboard(accKeyboards, {columns: 2})
              .oneTime()
              .resize()
              .removeKeyboard(true)
              .extra());
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async startBot(fromId, ctx, username, chatId) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.START_BOT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId hoặc all",
          this.cancelMenu);
      } else if (this.isUserNames(username)) {
        // Start by user
        // Filter all accountId by username
        let validBot = this.filterBotByUsername(username);

        if (validBot.length === 0) {
          await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
        } else {
          // If only user has only one accountId, go directly
          if (validBot.length === 1) {
            let user = validBot[0];
            if (this.config.tradeUsers[user.accountId].chatId == chatId) {
              let result: string = await this.notifyOnStartBotByUser(user.accountId);
              await ctx.reply(result, {reply_markup: {remove_keyboard: true}});
            }
          } else {
            this.command[fromId] = ACTION.START_BOT.id;
            this.commandData[fromId] = {isAdmin: false};
            // Otherwise, more than 1 accountId, show Keyboard
            // If more than 1 accountId show keyboard
            let accKeyboards: string[] = validBot.map(s => s.accountId);
            await ctx.reply('Chọn bot theo danh sách bên dưới.', Markup
              .keyboard(accKeyboards, {columns: 2})
              .oneTime()
              .resize()
              .removeKeyboard(true)
              .extra());
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async verifyUser(fromId, ctx, username) {
    try {
      if (!this.isAdmin(fromId) && !this.isUserNames(username)) return;
      this.command[fromId] = ACTION.VERIFY_USER.id;
      await ctx.reply("Gõ theo cú pháp:\n" +
        "accountId password\n" +
        "Ví dụ:\nL123456 abc123\n" +
        "Lưu ý:\n" +
        "Nhập đúng mật khẩu của tài khoản trade để bot xác thực với sàn giao dịch. " +
        "Trường hợp quên mật khẩu, bạn đăng nhập vào tk chính để thay đổi password cho tk trade nhé.\n" +
        "Bot không lưu mật khẩu, chỉ sử dụng để lấy token cho việc trade.\n" +
        "Tin nhắn của bạn sẽ được xoá ngay lập tức để đảm bảo an toàn.",
        this.cancelMenu);
    } catch (e) {
      logger.error(e);
    }
  }

  private async rootStopBot(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.ROOT_STOP_BOT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId hoặc all",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async editTime(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.EDIT_TIME.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId startTime endTime",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async editSplitCandles(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.SPLIT_CANDLES.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId splitCandleThStrategy splitOffsetStrategy\n" +
          "Mặc định:\n" +
          "splitCandleThStrategy=-1\n" +
          "splitOffsetStrategy=0",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async userActiveOrderId(fromId, ctx, username, chatId) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.USER_ACTIVE_ORDERID.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId strategyId\n" +
          "Mặc định:\n" +
          "strategyId=default\\_order",
          this.cancelMenu);
      } else if (this.isUserNames(username)) {
        let validBot = this.filterBotByUsername(username);

        if (validBot.length === 0) {
          await ctx.reply(USER_NOT_REGISTER_YET_MSG, {reply_markup: {remove_keyboard: true}});
        } else {
          // If only user has only one accountId, go directly
          if (validBot.length === 1) {
            let accountId = validBot[0].accountId;
            await this.onTextUserActiveOrderIdInputStep(fromId, accountId, ctx);
          } else {
            this.command[fromId] = ACTION.USER_ACTIVE_ORDERID.id;
            this.commandData[fromId] = {isAdmin: false, isFinalStep: false};
            // Otherwise, more than 1 accountId, show Keyboard
            // If more than 1 accountId show keyboard
            let accKeyboards: string[] = validBot.map(s => s.accountId);
            await ctx.reply('Chọn bot theo danh sách bên dưới.', Markup
              .keyboard(accKeyboards, {columns: 2})
              .oneTime()
              .resize()
              .removeKeyboard(true)
              .extra());
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async userClearOrderCache(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.USER_CLEAR_ORDER_CACHE.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId strategyId\n" +
          "Mặc định:\n" +
          "strategyId=default\\_order",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async userRegisterOrderId(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.USER_REGISTER_ORDERID.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId strategyId\n" +
          "Mặc định:\n" +
          "strategyId=default\\_order",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async userRemoveOrderId(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.USER_REMOVE_ORDERID.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId strategyId\n" +
          "Mặc định:\n" +
          "strategyId=default\\_order",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async sysUpStrategy(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.SYS_UP_STRATEGY.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply('Gõ: \nstrategyId\ndescription\nexample', this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async sysDownStrategy(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.SYS_DOWN_STRATEGY.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: strategyId", this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async announcement(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.ANNOUNCEMENT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ nội dung thông báo",
          Markup
            .keyboard([
              'Hệ thống sẽ tiến hành nâng cấp trong vòng 30 phút nữa. Dự kiến hoàn thành trong 2 giờ.',
              'Hệ thống sẽ tiến hành nâng cấp vào lúc 0h. Mọi người chủ động tắt bot trước thời gian trên để yên tâm hơn.',
              'Hệ thống đã nâng cấp xong. Mọi bot được khôi phục lại trạng thái trước đó.',
            ], {columns: 1})
            .oneTime()
            .resize()
            .removeKeyboard(true)
            .extra());
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async maintenance(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.MAINTENANCE.id;
        this.commandData[fromId] = {isAdmin: true};

        await ctx.reply("Gõ: status\n" +
          "Ví dụ: 0\n" +
          "Mặc định:\n" +
          "status=0 (false)",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async rootStartBot(fromId, ctx) {
    try {
      if (this.isAdmin(fromId)) {
        this.command[fromId] = ACTION.ROOT_START_BOT.id;
        this.commandData[fromId] = {isAdmin: true};
        await ctx.reply("Gõ: accountId hoặc all",
          this.cancelMenu);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async addBot(fromId, ctx) {
    try {
      if (!this.isAdmin(fromId)) return;
      this.command[fromId] = ACTION.ADD_BOT.id;
      await ctx.reply("Gõ theo cú pháp:\n" +
        "userId accountId password\n" +
        "Tin nhắn của bạn sẽ được xoá ngay lập tức để đảm bảo an toàn.",
        this.cancelMenu);
    } catch (e) {
      logger.error(e);
    }
  }

  private async addUser(fromId, ctx) {
    try {
      if (!this.isAdmin(fromId)) return;
      this.command[fromId] = ACTION.ADD_USER.id;
      await ctx.reply("Gõ theo cú pháp:\n" +
        "userId accountId telegram",
        this.cancelMenu);
    } catch (e) {
      logger.error(e);
    }
  }

  private async getUserToken(fromId: string, ctx) {
    try {
      if (!this.isAdmin(fromId)) return;
      this.command[fromId] = ACTION.TOKEN.id;
      await ctx.reply("Gõ theo cú pháp:\n" +
        "accountId password\n" +
        "Tin nhắn của bạn sẽ được xoá ngay lập tức để đảm bảo an toàn.",
        this.cancelMenu);
    } catch (e) {
      logger.error(e);
    }
  }

  private async getChatId(fromId: string, ctx, chatId) {
    try {
      if (!this.isAdmin(fromId)) return;
      this.command[fromId] = ACTION.CHATID.id;
      await ctx.reply(`Chat id is: ${chatId}`);
    } catch (e) {
      logger.error(e);
    }
  }

  async onStart() {
    try {
      if (this.bot) {
        await this.bot.launch();
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async onStop() {
    try {
      if (this.bot) {
        this.bot.stop();
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async onDestroy() {
    this.bot = null;
    this.command = {};
  }

  onMaintenanceHook(onMaintenance: (active: boolean) => Promise<string>) {
    this.notifyOnMaintenance = onMaintenance;
  }

  onRetrieveTokenHook(onRetrieveToken: (accountId: string, password: string) => Promise<string>) {
    this.notifyOnRetrieveToken = onRetrieveToken;
  }

  onAddUserHook(onAddUser: (userId: string, accountId: string, userName: string) => Promise<string>) {
    this.notifyOnAddUser = onAddUser;
  }

  onAddBotHook(onAddBot: (userId: string, accountId: string, password: string, chatId: string) => Promise<string>) {
    this.notifyOnAddBot = onAddBot;
  }

  onRootStartBotHook(onRootStartBot: (accountId: string) => Promise<string>) {
    this.notifyOnRootStartBot = onRootStartBot;
  }

  onRootStopBotHook(onRootStopBot: (accountId: string) => Promise<string>) {
    this.notifyOnRootStopBot = onRootStopBot;
  }

  onEditTimeHook(onEditTime: (accountId: string, startTime: string, endTime: string) => Promise<string>) {
    this.notifyOnEditTime = onEditTime;
  }

  onSplitCandlesHook(onSplitCandles: (accountId: string, splitCandleThStrategy: number, splitOffsetStrategy: number) => Promise<string>) {
    this.notifyOnSplitCandles = onSplitCandles;
  }

  onUserRemoveOrderIdHook(onUserRemoveOrderId: (accountId: string, strategyId: string) => Promise<string>) {
    this.notifyOnUserRemoveOrderId = onUserRemoveOrderId;
  }

  onUserClearOrderCacheHook(onUserClearOrderCache: (accountId: string, strategyId: string) => Promise<string>) {
    this.notifyOnUserClearOrderCache = onUserClearOrderCache;
  }

  onUserRegisterOrderIdHook(onUserRegisterOrderId: (accountId: string, strategyId: string) => Promise<string>) {
    this.notifyOnUserRegisterOrderId = onUserRegisterOrderId;
  }

  onUserActiveOrderIdHook(onUserActiveOrderId: (accountId: string, strategyRunning: string) => Promise<string>) {
    this.notifyOnUserActiveOrderId = onUserActiveOrderId;
  }

  onVerifyUserHook(onVerifyUser: (userId: string, accountId: string, password: string, chatId: string) => Promise<string>) {
    this.notifyOnVerifyUser = onVerifyUser;
  }

  onUpStrategyHook(onUpStrategy: (strategyId: string, description: string, example: string) => Promise<string>) {
    this.notifyOnUpStrategy = onUpStrategy;
  }

  onDownStrategyHook(onDownStrategy: (strategyId: string) => Promise<string>) {
    this.notifyOnDownStrategy = onDownStrategy;
  }

  onStartBotHook(onStartBot: (accountId: string) => Promise<string>) {
    this.notifyOnStartBot = onStartBot;
  }

  onStopBotHook(onStopBot: (accountId: string) => Promise<string>) {
    this.notifyOnStopBot = onStopBot;
  }

  onStartBotByUserHook(onStartBotByUser: (accountId: string) => Promise<string>) {
    this.notifyOnStartBotByUser = onStartBotByUser;
  }

  onStopBotByUserHook(onStopBotByUser: (accountId: string) => Promise<string>) {
    this.notifyOnStopBotByUser = onStopBotByUser;
  }

  onEditAmountHook(onEditAmount: (accountId: string, amount: number[]) => Promise<string>) {
    this.notifyOnEditAmount = onEditAmount;
  }

  onEditAmountByUserHook(onEditAmountByUser: (accountId: string, amount: number[]) => Promise<string>) {
    this.notifyOnEditAmountByUser = onEditAmountByUser;
  }

  onUserResetOrderIdListHook(onUserResetOrderIdList: (accountId: string, strategyList: string[]) => Promise<string>) {
    this.notifyOnUserResetOrderIdList = onUserResetOrderIdList;
  }

  // Send message
  sendMessageToAdmins = (message: string) => {
    this.config.helperBot.admin.forEach(c => {
      this.sendMessage(c, message);
    });
  };

  sendMessage = (chatId: string, message: string) => {
    this.bot.telegram.sendMessage(chatId, message).catch(error => {
      logger.error(error);
    });
  };

  isAdmin = (fromId: string): boolean => {
    // @nhancv 9/14/19: Need to parse fromId to String in indexOf case
    return this.config.helperBot.admin.indexOf(String(fromId)) > -1;
  };

  isUserNames = (username: string): boolean => {
    return this.isValidUsername(username);
  };

  isValidUsername = (username: string): boolean => {
    try {
      let res = this.config.helperBot.users ? this.config.helperBot.users.filter((s) => {
        return !!(s && s.userId != undefined && s.accountId != undefined && s.userName == username);
      }) : [];
      return res.length > 0;
    } catch (e) {
      logger.error(e);
      return false;
    }
  };

  getUserByUsername = (username: string, accountId: string): any => {
    try {
      let res = this.config.helperBot.users ? this.config.helperBot.users.filter((s) => {
        return (s && s.userId != undefined && s.accountId == accountId && s.userName == username);
      }) : [];
      if (res.length === 1) return res[0];
      return null;
    } catch (e) {
      logger.error(e);
      return null;
    }
  };

}
