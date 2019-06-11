const express = require('express');
const mysql = require('mysql');

function getConnection() {
    return mysql.createConnection({
        host: '35.204.124.30',
        port: '3306',
        user: 'root',
        password: 'admin',
        database: 'users',
    });
};

module.exports = getConnection;
