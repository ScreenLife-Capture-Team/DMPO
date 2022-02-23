const fs = require("fs");

class Downloader {
    constructor() {
        this.queue = [];
        this.maxNumDownloads = 1000;
        this.downloading = false
    }

    addFilesToQueue(files) {
        this.queue = [...this.queue, ...files];
    }

    printQueue() {
        console.log(`${this.queue.length} items in queue`);
    }

    async startDownloading() {
        for (let i = 0; i < this.maxNumDownloads; i++) {
            this.downloadProcess();
        }
    }

    async downloadProcess() {
        if (this.downloading) {
            return;
        }
        this.downloading = true
        while (this.queue.length > 0) {
            const file = this.queue.shift();
            await ensureDownload(file);
        }
        this.downloading = false
    }
}

const exists = async (destPath) => {
    return new Promise((resolve, reject) => {
        fs.stat(destPath, (err, stats) => {
            if (!err && stats.size > 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
};

const ensureDownload = async (file) => {
    return new Promise((resolve, reject) => {
        fs.mkdir(
            `./encrypted/${file.name.split("/")[0]}`,
            { recursive: true },
            () => {
                const path = `./encrypted/${file.name}`;
                fs.stat(path, (err, stats) => {
                    if (!err && stats.size > 0) {
                        resolve(true);
                    }
                });
                file.download({ destination: path }, (a) => {
                    resolve(true);
                });
            }
        );
    });
};

module.exports = { Downloader };
