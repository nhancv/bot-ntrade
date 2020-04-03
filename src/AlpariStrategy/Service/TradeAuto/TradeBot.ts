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
import LifeCycle from "../../Utils/LifeCycle";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');
/**
 * This bot for price notify
 */
export default class TradeBot implements LifeCycle {

  bot: any;
  config: any;

  constructor(config: any) {
    this.config = config;
  }

  async onCreate() {
    this.bot = new Telegraf(this.config.tradeBot.token);
    this.bot.telegram.getMe().then((botInfo) => {
      this.bot.options.username = botInfo.username
    });
    //middleware
    this.bot.use((ctx, next) => {
      if (ctx.updateType == 'callback_query' ||
        (ctx.updateType == 'message' && (this.isAdmin(String(ctx.message.from.id))))) {
        return next(ctx);
      }
    });

    // Admin only: Get chat id
    this.bot.command('chatId', async (ctx) => {
      if (!this.isAdmin(String(ctx.message.from.id))) return;
      let chatId = ctx.message.chat.id;
      await ctx.reply(`${chatId}`);
    });

    this.bot.start(async (ctx) => {
      await ctx.reply('Welcome');
    });
  }

  async onStart() {
    if (this.bot) {
      await this.bot.launch();
    }
  }

  async onStop() {
    if (this.bot) {
      this.bot.stop();
    }
  }

  async onDestroy() {
    this.bot = null;
    this.config = null;
  }

  /**
   * Send message
   * @param chatId
   * @param message
   */
  sendMessage = (chatId: string, message: string) => {
    this.bot.telegram.sendMessage(chatId, message, {reply_markup: {remove_keyboard: true}})
      .catch(error => {
        logger.error(error);
      });
  };

  isAdmin = (id: string): boolean => {
    // @nhancv 9/14/19: Need to parse fromId to String in indexOf case
    return this.config.tradeBot.admin.indexOf(String(id)) > -1;
  };

}
