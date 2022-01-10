const { app, BrowserWindow, ipcMain, dialog, ipcRenderer } = require("electron");
const fs = require("fs")
const { Storage } = require("@google-cloud/storage");
const { timePassedFromDate } = require("./util");
const checkInternetConnected = require('check-internet-connected');
const bcrypt = require('bcrypt');

let downloadQueue = []
let decryptionQueue = []
let censoringQueue = []

let settings = {}
if (fs.existsSync("settings.json")) {
    settings = JSON.parse(fs.readFileSync("settings.json"))
}

const PROJECTID =  settings.projectId
const BUCKETID = settings.bucketId
let PASSPHRASE = "" // MUST BE 16 CHARACTERS

if (!fs.existsSync("bucket_key.json")) {
    dialog.showErrorBox("Credentials Error", "bucket_key.json file missing. This is a credentials file, and will not be included in the main repository.")
    return;
}

const { resolve } = require("path");
const pythonPath = resolve("..\\censoring-scripts\\venv\\Scripts\\python.exe")
const scriptPath = resolve("..\\censoring-scripts\\main.py")

const CANCENSOR = fs.existsSync(pythonPath) && fs.existsSync(scriptPath)

const storage = new Storage({
    projectId: PROJECTID,
    keyFilename: "bucket_key.json",
});
const spawn = require("child_process").spawn;

let data = [];
let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    win.loadFile("dashboard/index.html");
    win.setMenu(null)
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

const getUserData = () => {
    if (!fs.existsSync("keys")) return []
    const files = fs.readdirSync("keys");
    const data = files.map(f => fs.readFileSync(`keys/${f}`))
    return data.map(d => JSON.parse(d))
}

const fetchUserImages = (prefix) => (
    new Promise((resolve) => {
        storage.bucket(BUCKETID).getFiles( { prefix }, (err, files, nQ, res) => {
            resolve(files)
        })
    })
)

const fetchData = async (event = null) => {
    // Fetches and combines user and image data

    const userData = getUserData();
    const imageData = await Promise.all(userData.map(ud => fetchUserImages(ud.hashedKey.slice(0, 8 ))))

    if (event) event.sender.send("update-status", "Processing data..") 
    if (event) event.sender.send("update-cancensor", CANCENSOR) 

    imageData.forEach((v, i) => {
        userData[i].numberInBucket = v.length;
        if (v.length > 0) {
            const filename = v[v.length - 1]?.name
            const date = filename.substring(filename.length-23, filename.length-4)
            const dC = date?.split("_")
            userData[i].timeSince = timePassedFromDate(new Date(dC[0], dC[1]-1, dC[2], dC[3], dC[4], dC[5]))
        }
    })

    return Object.values(userData)
};

ipcMain.handle("fetch-data", async (event, args) => {
    data = getUserData();
    try {
        data = await fetchData(event);
    }
    catch (err) {
        console.log('err', err)
    }
    event.sender.send("update-status", "Checking local folders..")
    data = await updateLocalFiles(data)
    event.sender.send("update-data", data)
    event.sender.send("update-status", "Updated")
    return data
});

ipcMain.handle("download-images", async (event, args) => {
    console.log("Downloading", args.hashedKey)
    downloadQueue.push(args)
    if (downloadQueue.length == 1) {
        console.log("Starting immediate download")
        download(args)
    } else {
        console.log("In queue:", downloadQueue.length)
    }
});

const download = async (args) => {
    const fileOptions = { directory: `${args.hashedKey.slice(0, 8)}` }
    console.log('BUCKETID', BUCKETID)
    const files = (await storage.bucket(BUCKETID).getFiles(fileOptions))[0]
    console.log('download', files)
    let downloadedCount = 0

    const markDownloaded = () => {
        downloadedCount += 1
        if (downloadedCount == args.numberInBucket) {
            console.log('Finished download of', args)
            downloadQueue.shift()
            if (downloadQueue.length > 0) 
                download(downloadQueue[0])
        } else {
            downloadNextFile()
        }
    }

    const downloadNextFile = () => {
        const file = files.shift()
        if (!file) return
        const dest = `./encrypted/${file.name}`
        fs.stat(dest, (err, stats) => {
            if (!err && stats.size > 0) { 
                // if the file already exists, count it as downloaded
                markDownloaded()
                return
            }
            file.download({ destination: dest, }, markDownloaded)
        })
    }
    
    fs.mkdir(`./encrypted/${args.hashedKey.slice(0,8)}`, { recursive: true}, () => {
        if (files.length == 0) {
            downloadQueue.shift()
            if (downloadQueue.length > 0) 
                download(downloadQueue[0])
        }
        for (let fileIndex in files) {
            if (fileIndex < 1000) downloadNextFile()
        }
    })
}

const getFiles = (folderPath, username) => (new Promise((resolve) => {
    fs.readdir(`.\\${folderPath}\\${username}`, (err, files) => {
        resolve(err ? [] : files.filter(f => !f.endsWith(".json")))
    })
}))

const isEmpty = (path) => (
    new Promise((resolve) => {
        fs.stat(path, (err, stats) => {
            if (err) resolve(0)
            resolve(stats.size === 0)
        })
    })
)

const watch = async (data, folderPath, name) => {
    const userFolders = fs.existsSync(`.\\${folderPath}`) ? fs.readdirSync(`.\\${folderPath}`, { withFileTypes:true }).filter(f => f.isDirectory()).map(f => f.name) : []
    const userFiles = await Promise.all(userFolders.map(un => getFiles(folderPath, un)))
    const userNumFiles = userFolders.reduce((a, f, i) => ({ ...a, [f]: userFiles[i].length }), {})
    const dataWithNumFiles = data.map((d) => {
        if (d.hashedKey) {
            val = (userFolders.includes(d.hashedKey.slice(0, 8))) ? userNumFiles[d.hashedKey.slice(0, 8)] : 0
            d[name] = val
        }
        return d
    })
    const usersNotInData = userFolders.filter(u => !(data.map(d => d.hashedKey.slice(0, 8)).includes(u)))
    return [
        ...dataWithNumFiles,
        ...usersNotInData.map(u => ({ username: u, [name]: userNumFiles[u]}))
    ]
}

const updateLocalFiles = async (data) => {
    data = await watch(data, "encrypted", "downloadedCount")
    data = await watch(data, "decrypted", "decryptedCount")
    data = await watch(data, "cleaned_automated", "cleanedAutomatedCount")
    data = await watch(data, "final", "finalCount")
    return data
}

const triggerUpdateLocalFiles = async () => {
    data = await updateLocalFiles(data)
    win.webContents.send("update-data", data)
}

ipcMain.handle("is-online", async (event, args) => { 
    try {
        await checkInternetConnected()
        return true
    } catch (e) {
        return false
    }
})

const isOnline = async () => {
    try {
        return await checkInternetConnected()
    } catch (e) {
        return false
    }
}

ipcMain.handle("decrypt-for-user", async (event, args) => {
    try {
        await checkInternetConnected()
        dialog.showErrorBox("Online Error", "Cannot decrypt while connected to the internet")
        decryptionQueue = []
        return;
    } catch (e) {
        // console.error(e)
    }
    decryptionQueue.push([event, args])
    if (decryptionQueue.length === 1) {
        decrypt(event, args)
    }
});

const decrypt = async (event, args) => {
    if (await isOnline()) {
        dialog.showErrorBox("Online Error", "Cannot decrypt while connected to the internet")
        return;
    }

    if (PASSPHRASE === "") {
        dialog.showErrorBox("Passphrase Error", "Please submit the project's passphrase before attempting decryption")
        decryptionQueue = [];
        return;
    }

    const key = decipher(args)
    const javaPath = settings.javaPath || "java.exe"
    const decryptorPath = resolve(".\\Decryptor.class")

    if (!fs.existsSync(decryptorPath)) {
        dialog.showErrorBox("Decryptor.class missing.")
        return
    }

    const folderName = resolve(`.\\encrypted\\${args.hashedKey.slice(0, 8)}\\`)
    const destFolderName = resolve(`.\\decrypted\\${args.hashedKey.slice(0, 8)}\\`)

    if (!fs.existsSync(folderName)) {
        dialog.showErrorBox("Missing folder error", `Missing folder "${folderName}"`)
        return
    }

    if (!fs.existsSync(destFolderName))
        fs.mkdirSync(destFolderName, { recursive: true })

    let process = spawn(javaPath, [`Decryptor`, `${key}`, `${folderName}`, destFolderName], )
    event.sender.send("update-status", "Started decrypting..")
    process.stdout.on("data", data => console.log("data", data.toString()))
    // process.stdout.on("data", data => {})
    process.stderr.on("data", data => {
        dialog.showErrorBox("Script Error", data.toString())
    })
    process.on("exit", code => {
        console.log('code', code)
        decryptionQueue.shift()
        if (decryptionQueue.length > 0) {
            decrypt(decryptionQueue[0][0], decryptionQueue[0][1])
        }
        if (code == 0 && args.acensor) {
            event.sender.send("start-automated-censoring", args)
        }
        triggerUpdateLocalFiles()
    })
}

ipcMain.handle("censor-for-user", async (event, args) => {

    try {
        await checkInternetConnected()
        dialog.showErrorBox("Online Error", "Cannot decrypt while connected to the internet")
        censoringQueue = []
        return;
    } catch (e) {
        // console.error(e)
    }

    censoringQueue.push(args)
    if (censoringQueue.length === 1) {
        censor(args)
    }

});

const censor = (args) => {
    console.log("Censoring (A) for user", args)

    const pythonPath = resolve("..\\censoring-scripts\\venv\\Scripts\\python.exe")
    const scriptPath = resolve("..\\censoring-scripts\\main.py")

    if (!fs.existsSync(pythonPath) || !fs.existsSync(scriptPath)) {
        dialog.showMessageBoxSync({
            message: "Automated Censoring module not detected! Please ensure the censoring-scripts folder is in the same folder as the manager's folder.",
            type: "error"
        })
        return
    }

    const folderName = resolve(`.\\decrypted\\${args.hashedKey.slice(0, 8)}\\`)
    const destFolderName = resolve(`.\\cleaned_automated\\${args.hashedKey.slice(0, 8)}\\`)

    if (!fs.existsSync(destFolderName)) 
        fs.mkdirSync(destFolderName, { recursive: true  })

    // event.sender.send("update-status", "Started automated censoring..")
    console.log("ACENSORING TO", scriptPath, folderName, destFolderName)
    let process = spawn(pythonPath, [scriptPath, folderName, destFolderName])
    process.stdout.on("data", data => console.log("data", data.toString()))
    process.stderr.on("data", data => dialog.showErrorBox("Script Error", data.toString()))
    process.on("exit", code => {
        console.log('code', code)
        censoringQueue.shift()
        if (censoringQueue.length > 0) {
            censor(censoringQueue[0])
        }
        triggerUpdateLocalFiles()
    })

}


ipcMain.handle("open-in-explorer", async (event, args) => {
    console.log("Opening in explorer", args)
    spawn("explorer.exe", [resolve(args)], )
})

const QRCode = require("qrcode")
const crypto = require("crypto")

ipcMain.handle("open-onboard-window", async (event, args) => {
    win = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
        },
    });
    win.loadFile("onboarding/onboarding.html");
    win.menuBarVisible = false;
})
 
ipcMain.handle("register", async (event, args) => {
    const { name } = args;

    if (!name) {
        console.log("Missing name on registration");
        return;
    }

    const key = crypto.randomBytes(32); 
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-128-gcm", Buffer.from(PASSPHRASE), iv);
    const encryptedKey = cipher.update(key).toString("hex");

    const hash = crypto.createHash("sha256");
    hash.update(key);
    const hashedKey = hash.digest("hex")

    fs.mkdirSync("keys", { recursive: true });
    fs.writeFileSync(`keys/${hashedKey}`, JSON.stringify({
        encryptedKey, hashedKey, iv: iv.toString("hex"), name
    }, null, 4));

    const qrcode = await QRCode.toDataURL(key.toString("hex"), { width: 1000 });

    decipher({ encryptedKey, iv: iv.toString("hex")})

    return { encryptedKey, hashedKey, qrcode }
})


const decipher = ({ encryptedKey, iv }) => {
    const _iv = Buffer.from(iv, "hex")
    const _key = Buffer.from(encryptedKey, "hex")
    const decipher = crypto.createDecipheriv("aes-128-gcm", Buffer.from(PASSPHRASE), _iv);
    const key = decipher.update(_key).toString("hex")
    return key
}

ipcMain.handle("remove-user", async (event, args) => {
    const { hashedKey } = args;
    const encryptedPath = "encrypted/" + hashedKey.slice(0, 8) + "/"
    if (fs.existsSync(encryptedPath)) fs.rmdirSync(encryptedPath, { recursive: true });
    const decryptedPath = "decrypted/" + hashedKey.slice(0, 8) + "/"
    if (fs.existsSync(decryptedPath)) fs.rmdirSync(decryptedPath, { recursive: true });
    const censoredPath = "cleaned_automated/" + hashedKey.slice(0, 8) + "/"
    if (fs.existsSync(censoredPath)) fs.rmdirSync(censoredPath, { recursive: true });
    const finalPath = "final/" + hashedKey.slice(0, 8) + "/"
    if (fs.existsSync(finalPath)) fs.rmdirSync(finalPath, { recursive: true });
    fs.unlinkSync("keys/" + hashedKey);
})

ipcMain.handle("set-passphrase", async (event, args) => {
    const { passphrase } = args;
    const cur = await new Promise((resolve, reject) => {
        bcrypt.hash(passphrase, 13, (err, hash) => {
            if (err) reject(err)
            resolve(hash)
        });
    })
    if (fs.existsSync("password_hash")) {
        const past = fs.readFileSync("password_hash", "utf8");
        if (!bcrypt.compareSync(passphrase, past)) {
            dialog.showMessageBoxSync({ 
                type: "error",
                message: "Incorrect passphrase. To reset the passphrase for a new project, delete the 'passphrase_hash' file."
            })
            return false;
        }
    }
    if (passphrase.length !== 16) {
        dialog.showErrorBox("Passphrase Error", "Passphrase must be 16 characters long")
        return;
    }
    fs.writeFileSync("password_hash", cur);
    PASSPHRASE = passphrase;
    return true;
})

const deleteFiles = async (files) => (
    new Promise((resolve) => { 
        let numLeft = files.length
        files.forEach((f, i) => {
            setTimeout(() => {
                console.log("Deleting", f.name)
                f.delete({}, async () => {
                    numLeft --; 
                    if (numLeft == 0) {
                        resolve()
                    }
                })
            }, Math.floor(i/500)*2000)
        })
    })
)

ipcMain.handle("clear-bucket", async (event, args) => {
    console.log("Clearing bucket of user", args)
    const username = args.hashedKey.slice(0, 8)
    const fileOptions = { directory: `${username}/`}
    const files = (await storage.bucket(BUCKETID).getFiles(fileOptions))[0]
    const numFiles = files.length
    const response = dialog.showMessageBoxSync(BrowserWindow.getAllWindows()[0], { 
        message: `Are you sure you want to clear the user ${username}'s bucket with ${numFiles} images?`, 
        buttons:[ "Yes", "No"], 
        type: "warning"
    })
    if (response == 0)  {
        await deleteFiles(files)
        data = await fetchData()
        data = updateLocalFiles(data)
        event.sender.send("update-data", data)
    }
});
