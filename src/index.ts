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
import {MongoProvider} from "./AlpariStrategy/Provider/MongoDB/MongoProvider";

// Init logger
const winston = require('winston');
require('winston-daily-rotate-file');

// Init dotenv
const result = require('dotenv').config({path: '.env'});
if (result.error) console.error(result.error.message);

const environment = process.env.NODE_ENV || 'dev';
// @nhancv 2019-09-10: Format log with specific timezone
const logFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf(
    info => moment(info.timestamp).utc().utcOffset("+0700").format() + '-' + environment + '-message:' + info.message
  ),
);
// @nhancv 2019-09-10: MongoConnect for file transport
const fileTransport = new winston.transports.DailyRotateFile({
  filename: './logs/%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  handleExceptions: true,
  zippedArchive: false,
  maxSize: '20m',
  maxFiles: '15d'
});
// @nhancv 2019-09-10: MongoConnect for console transport
const consoleTransport = new winston.transports.Console({
  handleExceptions: true,
});

// @nhancv 2019-09-10: Create new logger id
winston.loggers.add('Logger', {
  format: logFormat,
  transports: [
    fileTransport,
    consoleTransport,
  ]
});

// @nhancv 2019-09-10: Get logger from logger ID
const logger = winston.loggers.get('Logger');

// @nhancv 2019-09-06: Catch all unhandled Promise rejections
process.on('unhandledRejection', function (err) {
  logger.error(err);
});

import * as AlpariStrategy from "./AlpariStrategy"
import {MongoMigrate} from "./AlpariStrategy/Provider/MongoDB/MongoMigrate";

(async () => {
  try {
    // @nhancv 9/16/19: Connect db
    await MongoProvider.instance.connect();
    logger.info('Database connected');
    // @nhancv 9/16/19: Check migrate
    await new MongoMigrate().migrate();
    // @nhancv 9/16/19: Run app
    await AlpariStrategy.execute();
  } catch (e) {
    logger.error(e.message);
  }
})();

