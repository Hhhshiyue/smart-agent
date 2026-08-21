/**
 * 工具模块索引
 */

const logger = require('./logger');
const errors = require('./errors');

module.exports = {
  logger,
  ...errors
};