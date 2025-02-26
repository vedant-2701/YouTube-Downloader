const express = require('express');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));
app.use(express.static(path.join(__dirname)));

// Create downloads directory if it doesn't exist
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get available formats
app.get('/formats', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const info = await ytdl.getInfo(url);
        const formats = info.formats
            .filter(format => format.container === 'mp4')
            .map((format, index) => ({
                index,
                quality: format.qualityLabel || 'Audio only',
                hasVideo: format.hasVideo,
                hasAudio: format.hasAudio,
                formatId: format.itag
            }));

        res.json({
            title: info.videoDetails.title,
            formats: formats
        });
    } catch (error) {
        console.error('Error fetching formats:', error);
        res.status(500).json({ error: 'Error fetching formats: ' + error.message });
    }
});

// Download endpoint
app.post('/download', async (req, res) => {
    try {
        const { url, formatId } = req.body;

        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_');
        const format = info.formats.find(f => f.itag === parseInt(formatId));

        if (!format) {
            return res.status(400).json({ error: 'Invalid format selected' });
        }

        const filename = `${title}_${format.qualityLabel || 'audio'}.mp4`;
        const filePath = path.join(downloadDir, filename);

        ytdl(url, { format: format })
            .pipe(fs.createWriteStream(filePath))
            .on('finish', () => {
                res.json({
                    success: true,
                    downloadUrl: `/downloads/${filename}`,
                    filename: filename
                });
            })
            .on('error', (error) => {
                console.error('Download error:', error);
                res.status(500).json({ error: 'Download failed: ' + error.message });
            });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});