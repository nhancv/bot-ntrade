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

import BaseOrder from "./BaseOrder";
import {TradeUser} from "../../../Model/TradeUser";
import moment from "moment";

// @nhancv 2019-09-10: Logger
const winston = require('winston');
const logger = winston.loggers.get('Logger');

const timeZone = "+0700";
/**
 * This order is default of bot.
 * It will order with reverse current color.
 * + In valid time, the amount correct with sequence.
 * + In invalid time case, the amount will depend on splitCandleThStrategy and offset splitOffsetStrategy
 * Ex: current is green, it will order SELL with amount of that candles
 * Amount sequence: 0 0 1 2 5
 * splitCandleThStrategy = 4
 * splitOffsetStrategy = -1
 * Valid time from 0h -> 22h: Bot will order $1 at 3rd candle, $2 at 4th, $5 at 5th
 * Invalid time: Bot will order $1 at 4th candle, $2 at 5th, $5 at 6th
 */
export default class DefaultOrder implements BaseOrder {
  apply(isGreenCandle: boolean, amountCandles: number, tradeUser: TradeUser): { buy: boolean; amount: number } {
    // Input amount for each order
    // Ex: 0, 0, 0, 0, 0, 0, 1, 2, 4, 9, 27, 81, 162, 357 [play from candle 7th]
    let amountStrategy = tradeUser.amountStrategy;
    // If except valid time, will trigger add candle [splitCandleThStrategy]th:
    // condition: splitCandleThStrategy > 0 && amountCandles >= splitCandleThStrategy
    let splitCandleThStrategy = tradeUser.splitCandleThStrategy;
    // Normal case input at 5th: 0 0 0 0 1 2 4
    // In splitCandleThStrategy mode, input candles will be combined with offset
    // splitOffsetStrategy = -1 and splitCandleThStrategy = 9 mean at candle 9th will input price from amount[9 - 1]
    let splitOffsetStrategy = tradeUser.splitOffsetStrategy;

    let startTrade = moment(tradeUser.startTrade, "HH:mm:ss");
    let stopTrade = moment(tradeUser.stopTrade, "HH:mm:ss");

    let validTime = false;
    if (startTrade.isValid() && stopTrade.isValid()) {
      let now = moment.utc().utcOffset(timeZone);
      let validFrom = now.clone().set({
        'hour': startTrade.hour(),
        'minute': startTrade.minute(),
        'second': startTrade.second()
      });
      let validTo = now.clone().set({
        'hour': stopTrade.hour(),
        'minute': stopTrade.minute(),
        'second': stopTrade.second()
      });
      // @nhancv 2019-09-10: Need to check remaining candles with current strategy for safety order
      // idea: current is 5th candle, last amount > 0 of strategy has index is 10th
      // => remaining = 10 - 5 = 5 => now + remaining <= validTimeTo
      // 1 candle take 1 minute
      let lastAmountCandle = 1;
      for (let i = amountStrategy.length - 1; i >= 0; i--) {
        if (amountStrategy[i] != 0) {
          lastAmountCandle = (i + 1);
          break;
        }
      }
      let remainingCandles = lastAmountCandle - amountCandles;
      if (remainingCandles >= 0) {
        validTime = now.add(remainingCandles, 'm').isBetween(validFrom, validTo, undefined, '[]');
      }
    }

    if (validTime || (splitCandleThStrategy > 0 && amountCandles >= splitCandleThStrategy)) {
      let amount = 0;

      if (validTime) {
        if (amountCandles > 0 && amountCandles <= amountStrategy.length) {
          amount = amountStrategy[amountCandles - 1];
        }
      } else if (splitCandleThStrategy > 0 && amountCandles >= splitCandleThStrategy) {
        let newAmountCandles = amountCandles + splitOffsetStrategy;
        if (newAmountCandles > 0 && newAmountCandles <= amountStrategy.length) {
          amount = amountStrategy[newAmountCandles - 1];
        }
      }

      // @nhancv 9/21/19: Amount > 0 will order opposite with current color. If amount < 0 will order same color with current
      // Ex:
      // amount = 1, current is green -> will order sell $1
      // amount = -1, current is green -> will order buy $1
      // amount = 0, do nothing
      if (amount > 0) {
        logger.info(`${tradeUser.accountId} DefaultOrder checking ok [B:${!isGreenCandle},A:${amount}]`);
        return {buy: !isGreenCandle, amount: amount};
      } else if (amount < 0) {
        logger.info(`${tradeUser.accountId} DefaultOrder checking ok [B:${isGreenCandle},A:${-amount}]`);
        return {buy: isGreenCandle, amount: -amount};
      }
    }
    return {buy: false, amount: 0};
  }
}
