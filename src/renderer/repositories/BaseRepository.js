/**
 * Base repository class for database operations
 * Provides common CRUD operations and query building
 */
export class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.api = window.api;
  }

  /**
   * Execute a SELECT query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Query results
   */
  async select(query, params = []) {
    try {
      return await this.api.select(query, params);
    } catch (error) {
      console.error(`Error in ${this.tableName} select:`, error);
      throw new Error(`Failed to fetch ${this.tableName} data: ${error.message}`);
    }
  }

  /**
   * Execute an INSERT query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Insert result
   */
  async insert(query, params = []) {
    try {
      return await this.api.insert(query, params);
    } catch (error) {
      console.error(`Error in ${this.tableName} insert:`, error);
      throw new Error(`Failed to insert ${this.tableName} data: ${error.message}`);
    }
  }

  /**
   * Execute a DELETE query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Delete result
   */
  async delete(query, params = []) {
    try {
      return await this.api.delete(query, params);
    } catch (error) {
      console.error(`Error in ${this.tableName} delete:`, error);
      throw new Error(`Failed to delete ${this.tableName} data: ${error.message}`);
    }
  }

  /**
   * Find all records
   * @returns {Promise<Array>} All records
   */
  async findAll() {
    const query = `SELECT * FROM ${this.tableName}`;
    return this.select(query);
  }

  /**
   * Find record by ID
   * @param {string} id - Record ID
   * @param {string} idColumn - Name of ID column (default: 'id')
   * @returns {Promise<Object>} Single record
   */
  async findById(id, idColumn = 'id') {
    const query = `SELECT * FROM ${this.tableName} WHERE ${idColumn} = ?`;
    const results = await this.select(query, [id]);
    return results[0];
  }

  /**
   * Find records by condition
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Promise<Array>} Matching records
   */
  async findBy(conditions) {
    const keys = Object.keys(conditions);
    const whereClause = keys.map(key => `${key} = ?`).join(' AND ');
    const values = keys.map(key => conditions[key]);
    
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
    return this.select(query, values);
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Insert result
   */
  async create(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(key => data[key]);
    
    const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    return this.insert(query, values);
  }

  /**
   * Update a record
   * @param {string} id - Record ID
   * @param {Object} data - Update data
   * @param {string} idColumn - Name of ID column (default: 'id')
   * @returns {Promise<Object>} Update result
   */
  async update(id, data, idColumn = 'id') {
    const keys = Object.keys(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = [...keys.map(key => data[key]), id];

    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE ${idColumn} = ?`;
    return this.insert(query, values);
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @param {string} idColumn - Name of ID column (default: 'id')
   * @returns {Promise<Object>} Delete result
   */
  async deleteById(id, idColumn = 'id') {
    const query = `DELETE FROM ${this.tableName} WHERE ${idColumn} = ?`;
    return this.delete(query, [id]);
  }

  /**
   * Count records
   * @param {Object} conditions - Optional conditions for WHERE clause
   * @returns {Promise<number>} Record count
   */
  async count(conditions = {}) {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    let params = [];
    
    const keys = Object.keys(conditions);
    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(' AND ');
      query += ` WHERE ${whereClause}`;
      params = keys.map(key => conditions[key]);
    }
    
    const result = await this.select(query, params);
    return result[0].count;
  }

  /**
   * Execute raw query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Query results
   */
  async raw(query, params = []) {
    return this.select(query, params);
  }
}