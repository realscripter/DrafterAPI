// Test file to check routing
import express from 'express';
const app = express();

try {
    app.get('*', (req, res) => {
        res.send('ok');
    });
    console.log('Wildcard * works');
} catch (e) {
    console.log('Wildcard * failed:', e.message);
}

try {
    app.get('(.*)', (req, res) => {
        res.send('ok');
    });
    console.log('Wildcard (.*) works');
} catch (e) {
    console.log('Wildcard (.*) failed:', e.message);
}
