const db = {
        host: '35.204.124.30',
        user: 'root',
        password: 'admin',
        table: 'users',
};

const dbknex = {
    client: 'mysql',
    connection: {
        host: '35.204.124.30',
        user: 'root',
        password: 'admin',
        database: 'users'
    }
};

module.exports = db;
module.exports = dbknex;