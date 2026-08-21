/**
 * 安全数学表达式解析器
 * 使用递归下降解析器，完全避免 eval()
 * 支持: +, -, *, /, %, 括号, 小数, 负数
 */

class MathParser {
  constructor(input) {
    this.input = input.replace(/\s+/g, '');
    this.pos = 0;
  }

  parse() {
    const result = this.parseExpression();
    if (this.pos < this.input.length) {
      throw new Error(`意外字符: '${this.input[this.pos]}'`);
    }
    return result;
  }

  // 表达式: 项 (('+' | '-') 项)*
  parseExpression() {
    let left = this.parseTerm();
    
    while (this.pos < this.input.length) {
      const op = this.input[this.pos];
      if (op === '+' || op === '-') {
        this.pos++;
        const right = this.parseTerm();
        if (op === '+') left += right;
        else left -= right;
      } else {
        break;
      }
    }
    
    return left;
  }

  // 项: 因子 (('*' | '/' | '%') 因子)*
  parseTerm() {
    let left = this.parseFactor();
    
    while (this.pos < this.input.length) {
      const op = this.input[this.pos];
      if (op === '*' || op === '/' || op === '%') {
        this.pos++;
        const right = this.parseFactor();
        if (op === '*') left *= right;
        else if (op === '/') {
          if (right === 0) throw new Error('除数不能为零');
          left /= right;
        } else {
          if (right === 0) throw new Error('除数不能为零');
          left %= right;
        }
      } else {
        break;
      }
    }
    
    return left;
  }

  // 因子: ('+' | '-') 因子 | 数字 | '(' 表达式 ')'
  parseFactor() {
    if (this.pos >= this.input.length) {
      throw new Error('表达式不完整');
    }

    const ch = this.input[this.pos];

    // 一元运算符
    if (ch === '+') {
      this.pos++;
      return this.parseFactor();
    }
    if (ch === '-') {
      this.pos++;
      return -this.parseFactor();
    }

    // 括号表达式
    if (ch === '(') {
      this.pos++;
      const result = this.parseExpression();
      if (this.pos >= this.input.length || this.input[this.pos] !== ')') {
        throw new Error('缺少右括号');
      }
      this.pos++;
      return result;
    }

    // 数字
    return this.parseNumber();
  }

  // 解析数字（整数或小数）
  parseNumber() {
    let start = this.pos;
    let hasDot = false;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch >= '0' && ch <= '9') {
        this.pos++;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
        this.pos++;
      } else {
        break;
      }
    }

    if (this.pos === start) {
      throw new Error(`期望数字，得到: '${this.input[this.pos]}'`);
    }

    const numStr = this.input.substring(start, this.pos);
    const num = parseFloat(numStr);
    
    if (isNaN(num)) {
      throw new Error(`无效的数字: '${numStr}'`);
    }

    return num;
  }
}

/**
 * 安全计算数学表达式
 * @param {string} expression - 数学表达式
 * @returns {number} 计算结果
 */
function safeCalculate(expression) {
  // 验证输入：只允许数字、运算符、括号和小数点
  const safePattern = /^[0-9+\-*/%().\s]+$/;
  if (!safePattern.test(expression)) {
    throw new Error('表达式包含不允许的字符');
  }

  // 检查括号匹配
  let stack = 0;
  for (const char of expression) {
    if (char === '(') stack++;
    if (char === ')') stack--;
    if (stack < 0) throw new Error('括号不匹配');
  }
  if (stack !== 0) throw new Error('括号不匹配');

  const cleanExpr = expression.replace(/\s+/g, '');

  // 检查连续运算符（3个或更多连续运算符）
  const consecutiveOpPattern = /[+\-*/%]{3,}/;
  if (consecutiveOpPattern.test(cleanExpr)) {
    throw new Error('包含连续运算符，表达式无效');
  }

  // 检查表达式开头：允许 +、-、数字、括号
  // 但不能以 *、/、% 开头
  if (/^[*/%]/.test(cleanExpr)) {
    throw new Error('表达式不能以乘除模运算符开头');
  }

  // 检查表达式结尾：必须以数字或括号结尾
  if (/[+\-*/%]$/.test(cleanExpr)) {
    throw new Error('表达式不能以运算符结尾');
  }

  // 检查连续运算符模式
  // 允许: -5, (-5), 5+3, 5-3, -2*3, 2*-3, -2*-3, 10+-3, 5--3
  // 不允许: ++5, 5++3, **5, //5, +5 (单独的前置加号), 5++3
  
  // 检查1: 连续相同的运算符（除了 -- ，因为 5--3 是合法的）
  // ++ 和 ** 和 // 和 %% 肯定是不允许的
  const invalidSameOps = /(\+\+|\*\*|\/\/|%%)/;
  if (invalidSameOps.test(cleanExpr)) {
    throw new Error('包含连续运算符，表达式无效');
  }
  
  // 检查2: -- 后面必须跟数字或括号（如 -3 或 (-5)）
  // 不允许: 5-- (没有后续数字)
  if (/--[^0-9(-]/.test(cleanExpr)) {
    throw new Error('运算符使用无效');
  }
  
  // 检查3: 以 + 开头直接跟数字（单独的前置加号，如 +5）
  if (/^\+\d/.test(cleanExpr)) {
    throw new Error('运算符使用无效');
  }
  
  // 检查4: +- 或 -+ 后跟非数字（即不是 10+-3 这种情况）
  if (/\+-[^0-9(]/.test(cleanExpr)) {
    throw new Error('运算符使用无效');
  }
  if (/-\+[^0-9(]/.test(cleanExpr)) {
    throw new Error('运算符使用无效');
  }

  const parser = new MathParser(expression);
  return parser.parse();
}

module.exports = { safeCalculate, MathParser };