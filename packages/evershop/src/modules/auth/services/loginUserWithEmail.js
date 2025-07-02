import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { comparePassword } from '../../../lib/util/passwordHelper.js';

/**
 * This function will login the admin user with email and password. This function must be accessed from the request object (request.loginUserWithEmail(email, password, callback))
 * @param {string} email
 * @param {string} password
 */
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../../../config/adminCredentials.js';

async function loginUserWithEmail(email, password) {
  // Check if the provided credentials match our fixed admin credentials
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    // Get the admin user from the database
    const user = await select()
      .from('admin_user')
      .where('email', 'ILIKE', ADMIN_EMAIL)
      .and('status', '=', 1)
      .load(pool);

    if (!user) {
      throw new Error('Admin user not found');
    }

    this.session.userID = user.admin_user_id;
    // Delete the password field
    delete user.password;
    // Save the user in the request
    this.locals.user = user;
  } else {
    throw new Error('Invalid email or password');
  }
}

export default loginUserWithEmail;
