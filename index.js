const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));

// GitHub & Ngrok Token from environment variables
const githubToken = process.env.GITHUB_TOKEN;
const ngrokAuthToken = process.env.NGROK_AUTHTOKEN;

// GitHub Actions status
async function getGitHubActionsStatus() {
    try {
        const response = await axios.get('https://api.github.com/repos/YOUR_GITHUB_USER/YOUR_REPO/actions/runs', {
            headers: {
                Authorization: `Bearer ${githubToken}`,
            },
        });
        return response.data.workflow_runs[0] ? response.data.workflow_runs[0].status : 'Unknown';
    } catch (error) {
        console.error('Error fetching GitHub Actions status:', error);
        return 'Error';
    }
}

// Ngrok URL & Port status
async function getNgrokUrl() {
    try {
        const response = await axios.get('http://localhost:4040/api/tunnels');
        const tunnel = response.data.tunnels[0]; // Assuming the first tunnel
        return tunnel ? `${tunnel.public_url}:${tunnel.config.addr.split(':')[1]}` : 'Ngrok not connected';
    } catch (error) {
        console.error('Error fetching Ngrok URL:', error);
        return 'Error';
    }
}

// Restart GitHub Actions if it's down
async function triggerGitHubActions() {
    try {
        await axios.post('https://api.github.com/repos/YOUR_GITHUB_USER/YOUR_REPO/actions/workflows/YOUR_WORKFLOW_FILE/dispatches', 
            {
                ref: 'main', // or any branch you want to trigger
            }, 
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                },
            });
        console.log('GitHub Actions triggered successfully.');
    } catch (error) {
        console.error('Error triggering GitHub Actions:', error);
    }
}

// Restart Ngrok if it's down
function restartNgrok() {
    exec('pkill ngrok', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error stopping Ngrok: ${stderr}`);
            return;
        }
        console.log('Ngrok stopped.');
        exec('ngrok http 8080', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error starting Ngrok: ${stderr}`);
                return;
            }
            console.log('Ngrok restarted.');
        });
    });
}

// Monitor GitHub Actions and Ngrok
async function monitor() {
    const githubStatus = await getGitHubActionsStatus();
    if (githubStatus !== 'success') {
        console.log('GitHub Actions is down, triggering...');
        await triggerGitHubActions();
    }

    const ngrokStatus = await getNgrokUrl();
    if (ngrokStatus.includes('Error') || ngrokStatus.includes('not connected')) {
        console.log('Ngrok is down, restarting...');
        restartNgrok();
    }
}

// Run the monitor function periodically
setInterval(monitor, 60000); // Check every minute

// Serve the homepage and display the status
app.get('/', async (req, res) => {
    const githubStatus = await getGitHubActionsStatus();
    const ngrokUrl = await getNgrokUrl();
    
    res.render('index', { githubStatus, ngrokUrl });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});