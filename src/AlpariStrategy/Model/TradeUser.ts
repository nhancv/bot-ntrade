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

export interface TradeUser {
  _id?: string;
  start: boolean;
  isRunning: boolean;
  startTrade: string;
  stopTrade: string;
  chatId: string;
  userId: string;
  accountId: string;
  accountAlias: string;
  token: string;
  // Input amount for each order
  // Ex: 0, 0, 0, 0, 0, 0, 1, 2, 4, 9, 27, 81, 162, 357 [play from candle 7th]
  amountStrategy: number[];
  // If except valid time, will trigger add candle [splitCandleThStrategy]th:
  // condition: splitCandleThStrategy > 0 && amountCandles >= splitCandleThStrategy
  splitCandleThStrategy: number;
  // Normal case input at 5th: 0 0 0 0 1 2 4
  // In splitCandleThStrategy mode, input candles will be combined with offset
  // splitOffsetStrategy = -1 and splitCandleThStrategy = 9 mean at candle 9th will input price from amount[9 - 1]
  splitOffsetStrategy: number;

  // Strategy list
  strategyList: string[];
  // Current strategy, default is default_order
  strategyRunning: string;
}

export const TradeUser_TableName = "trade_users";
