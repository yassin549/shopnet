import { select, insert } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { comparePassword } from '../../../lib/util/passwordHelper.js';
import bcrypt from 'bcrypt';
import { rateLimiter } from '../../../lib/security/rateLimiter.js';
import { logger } from '../../../lib/logging/logger.js';
import { generateCSRFToken } from '../../../lib/security/csrf.js';

/**
 * This function handles user login with email and password. It supports both admin and regular user authentication.
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @throws {Error} Throws an error if login fails
 */
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../../../config/adminCredentials.js';

async function loginUserWithEmail(email, password) {
  try {
    // Rate limiting for login attempts
    await rateLimiter.checkRateLimit(this.ip, 'login');

    // Validate input
    if (!email || !password) {
      throw new Error('Invalid credentials');
    }

    // First check if this is an admin login attempt
    if (email === ADMIN_EMAIL) {
      // For admin login, we enforce the fixed credentials
      if (password === ADMIN_PASSWORD) {
        // Get or create the admin user
        const user = await select()
          .from('admin_user')
          .where('email', 'ILIKE', ADMIN_EMAIL)
          .and('status', '=', 1)
          .load(pool);

        if (!user) {
          // Create the admin user if it doesn't exist
          const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12); // Increased salt rounds for admin
          await insert('admin_user')
            .value('email', ADMIN_EMAIL)
            .value('password', hashedPassword)
            .value('status', 1)
            .value('name', 'Admin User')
            .value('created_at', new Date())
            .value('updated_at', new Date())
            .execute(pool);
          
          // Get the newly created user
          const newUser = await select()
            .from('admin_user')
            .where('email', 'ILIKE', ADMIN_EMAIL)
            .and('status', '=', 1)
            .load(pool);
          
          // Set up secure session
          this.session.userID = newUser.admin_user_id;
          this.session.admin = true;
          this.session.csrfToken = generateCSRFToken();
          delete newUser.password;
          this.locals.user = newUser;
          return;
        }
        
        // If admin exists, use their stored credentials
        const result = await comparePassword(password, user.password);
        if (result) {
          // Set up secure session
          this.session.userID = user.admin_user_id;
          this.session.admin = true;
          this.session.csrfToken = generateCSRFToken();
          delete user.password;
          this.locals.user = user;
          return;
        }
      }
      
      throw new Error('Invalid credentials');
    }

    // For normal user login, use database authentication
    const user = await select()
      .from('admin_user')
      .where('email', 'ILIKE', email.replace(/%/g, '\\%'))
      .and('status', '=', 1)
      .load(pool);
    
    if (!user) {
      // Don't reveal if email exists
      throw new Error('Invalid credentials');
    }

    const result = await comparePassword(password, user.password);
    if (!result) {
      throw new Error('Invalid credentials');
    }

    // Set up secure session
    this.session.userID = user.admin_user_id;
    this.session.csrfToken = generateCSRFToken();
    this.session.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
    delete user.password;
    this.locals.user = user;

    // Log successful login
    logger.info({
      event: 'user.login.success',
      userId: user.admin_user_id,
      email: user.email,
      isAdmin: false
    });

  } catch (error) {
    // Log failed login attempt
    logger.warn({
      event: 'user.login.failure',
      error: error.message,
      email: email
    });

    // Rate limit on failed attempts
    await rateLimiter.incrementFailedAttempts(this.ip, 'login');

    // Don't reveal specific error details to client
    throw new Error('Invalid credentials');
  }
}

export default loginUserWithEmail;
