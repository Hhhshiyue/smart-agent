/**
 * JWT 认证中间件
 * 提供 API 访问控制
 * 密码使用 scrypt 加密存储，用户数据持久化到 data/users.json
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

class AuthMiddleware {
  constructor(config = {}) {
    this.secret = config.secret || process.env.JWT_SECRET || 'smart-agent-secret-key-change-in-production';
    this.expiresIn = config.expiresIn || '24h';
    this.enabled = config.enabled !== false && process.env.AUTH_ENABLED !== 'false';
    this.whitelist = config.whitelist || [
      '/api/health',
      '/api/info',
      '/api/stream/test',
      '/api/agent/chat',
      '/api/agent/run',
      '/api/tools',
      '/'
    ];

    // 用户数据库（持久化到文件）
    this.usersFile = path.join(__dirname, '../../data/users.json');
    this.users = new Map();
    this.initDefaultUsers();
  }

  /**
   * 密码哈希（scrypt，零第三方依赖）
   * @param {string} password - 明文密码
   * @returns {string} 存储格式: scrypt$salt$hash
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
  }

  /**
   * 校验密码
   * @param {string} password - 明文密码
   * @param {string} stored - 存储的哈希
   * @returns {boolean} 是否匹配
   */
  verifyPassword(password, stored) {
    if (!stored || !stored.startsWith('scrypt$')) {
      return false;
    }
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const hash = parts[2];
    const calc = crypto.scryptSync(String(password), salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(hash, 'hex'));
    } catch (e) {
      return false;
    }
  }

  /**
   * 持久化用户数据到文件
   */
  saveUsers() {
    try {
      const data = {};
      this.users.forEach((user, username) => {
        data[username] = user;
      });
      fs.mkdirSync(path.dirname(this.usersFile), { recursive: true });
      fs.writeFileSync(this.usersFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存用户数据失败:', error.message);
    }
  }

  /**
   * 从文件加载用户数据
   */
  loadUsers() {
    try {
      if (fs.existsSync(this.usersFile)) {
        const data = JSON.parse(fs.readFileSync(this.usersFile, 'utf-8'));
        for (const [username, user] of Object.entries(data)) {
          this.users.set(username, user);
        }
      }
    } catch (error) {
      console.error('加载用户数据失败:', error.message);
    }
  }

  /**
   * 初始化默认用户
   */
  initDefaultUsers() {
    this.loadUsers();
    // 首次运行时创建默认用户（密码已加密存储）
    if (this.users.size === 0) {
      this.addUser('admin', 'admin123', { role: 'admin' });
      this.addUser('user', 'user123', { role: 'user' });
      console.log('[Auth] 已创建默认用户（admin / admin123），请在设置中修改密码');
    }
  }

  /**
   * 添加用户
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {object} metadata - 用户元数据
   */
  addUser(username, password, metadata = {}) {
    this.users.set(username, {
      username,
      password: this.hashPassword(password),
      ...metadata,
      createdAt: new Date().toISOString()
    });
    this.saveUsers();
  }

  /**
   * 验证用户
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {object|null} 用户信息或 null
   */
  authenticate(username, password) {
    const user = this.users.get(username);

    if (!user) {
      return null;
    }

    if (!this.verifyPassword(password, user.password)) {
      return null;
    }

    return {
      username: user.username,
      role: user.role
    };
  }

  /**
   * 修改密码（持久化）
   * @param {string} username - 用户名
   * @param {string} newPassword - 新密码
   * @returns {boolean} 是否成功
   */
  updatePassword(username, newPassword) {
    const user = this.users.get(username);
    if (!user) return false;
    if (!newPassword || String(newPassword).length < 4) return false;
    user.password = this.hashPassword(newPassword);
    this.saveUsers();
    return true;
  }

  /**
   * 生成 JWT Token
   * @param {object} payload - Token 载荷
   * @returns {string} JWT Token
   */
  generateToken(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  /**
   * 验证 JWT Token
   * @param {string} token - JWT Token
   * @returns {object|null} 解码后的载荷或 null
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      return null;
    }
  }

  /**
   * 认证中间件
   * @param {object} req - Express 请求对象
   * @param {object} res - Express 响应对象
   * @param {function} next - 下一个中间件
   */
  middleware(req, res, next) {
    // 如果认证未启用，直接通过
    if (!this.enabled) {
      return next();
    }
    
    // 检查白名单
    if (this.whitelist.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // 获取 Token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: '缺少认证令牌'
      });
    }
    
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: '认证令牌格式错误'
      });
    }
    
    const token = parts[1];
    const decoded = this.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: '认证令牌无效或已过期'
      });
    }
    
    // 将用户信息添加到请求对象
    req.user = decoded;
    next();
  }

  /**
   * 登录路由处理器
   */
  loginHandler = (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少用户名或密码'
      });
    }
    
    const user = this.authenticate(username, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }
    
    const token = this.generateToken(user);
    
    res.json({
      success: true,
      data: {
        token,
        user,
        expiresIn: this.expiresIn
      }
    });
  };

  /**
   * 权限检查中间件
   * @param {string} role - 所需角色
   * @returns {function} 中间件函数
   */
  requireRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '未认证'
        });
      }
      
      if (req.user.role !== role && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: '权限不足'
        });
      }
      
      next();
    };
  }

  /**
   * 获取用户信息
   * @param {string} username - 用户名
   * @returns {object|null} 用户信息
   */
  getUser(username) {
    const user = this.users.get(username);
    if (!user) return null;
    
    // 不返回密码
    const { password, ...userInfo } = user;
    return userInfo;
  }

  /**
   * 获取所有用户
   * @returns {array} 用户列表
   */
  getAllUsers() {
    const users = [];
    this.users.forEach((user, username) => {
      const { password, ...userInfo } = user;
      users.push(userInfo);
    });
    return users;
  }

  /**
   * 删除用户
   * @param {string} username - 用户名
   * @returns {boolean} 是否成功
   */
  deleteUser(username) {
    const ok = this.users.delete(username);
    if (ok) {
      this.saveUsers();
    }
    return ok;
  }
}

module.exports = AuthMiddleware;
