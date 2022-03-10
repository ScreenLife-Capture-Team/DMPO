const { dialog } = require('electron');
const electron = require('electron');
const { ipcRenderer } = require('electron/renderer');

let data = [];
let canCensor = false;

function main() {
    electron.ipcRenderer.invoke("fetch-data", { full: true })
    document.getElementById("refresh-button").onclick = () => {
        electron.ipcRenderer.invoke("fetch-data", { full: true })
    }
    document.getElementById("onboard-button").onclick = () => {
        ipcRenderer.invoke("open-onboard-window" )
    }
    document.getElementById("passphrase-button").onclick = async () => {
        const passphrase = document.getElementById("passphrase-input").value
        const didSet = await ipcRenderer.invoke("set-passphrase", { passphrase })
        if (didSet) {
            document.getElementById("passphrase-button").style.display = "none";
            document.getElementById("passphrase-input").style.display = "none";
            document.getElementById("onboard-button").style.display = "block";
        }
    }
    document.getElementById("passphrase-input").addEventListener("keyup", (event) => {
    if (event.keyCode === 13) {
        event.preventDefault();
        document.getElementById("passphrase-button").click();
    }
    });
    ipcRenderer.on("update-cancensor", (e, args) => { 
        canCensor = args
        render()
    })
    ipcRenderer.on("update-data", (e, args) => { 
        data = args
        render()
    })
    ipcRenderer.on("update-status", (e, args) => { 
        const usersCount = document.getElementById("users-count")
        usersCount.innerText = args
    })

    setInterval(() => {
        // electron.ipcRenderer.invoke("fetch-data", { full: false })
        // .then(d => {
        //    if (JSON.stringify(d) !== JSON.stringify(data)) {
        //        data = d
        //        render()
        //    }
        // }) 
        electron.ipcRenderer.invoke("is-online")
        .then(online => {
            if (online && data.some(d => (d.decryptedCount && d.decryptedCount != 0) || (d.cleanedAutomatedCount && d.cleanedAutomatedCount != 0))) {
                document.getElementById("online-warning").innerText = "WARNING: Decrypted / Automatically Censored Images detected while Online"
                document.getElementById("online-warning").style.display = "inline-block"
                document.getElementById("decrypt-all-button").style.display = "none"
            } else {
                document.getElementById("online-warning").innerText = ""
                document.getElementById("online-warning").style.display = "none"
                document.getElementById("decrypt-all-button").style.display = "inline-block"
            }
        }) 
    }, 5000)
}


function createNode(type, text, className) {
    const temp = document.createElement(type)
    if (text != null) temp.textContent = text
    if (className != null) temp.className = className
    return temp
}

function render() {
    console.log("DATA", data)
    const usersCount = document.getElementById("users-count")
    usersCount.innerText = `${data.length} users loaded.`

    const mainBody = document.getElementById("main")
    mainBody.textContent = ""

    const table = document.createElement("table")
    table.className = "tableFixHead"

    const headerContainer = document.createElement("thead")
    const header = document.createElement("tr")
    header.appendChild(createNode("th", "Username", "username-label"))
    header.appendChild(createNode("th", "Last Capture", "time-label"))
    header.appendChild(createNode("th", "In Bucket", "number"))
    header.appendChild(createNode("th", "Downloaded", "number"))
    header.appendChild(createNode("th", "Decrypted", "number"))
    if (canCensor) header.appendChild(createNode("th", "Censored(A)", "number"))

    const buttonBox = createNode("th", "")

    let button = createNode("p", "Download All", "button default-hidden")
    button.onclick = () => {
        console.log("downloading all")
        data.forEach(user => {
            ipcRenderer.invoke("download-images", user)
        })
    }
    buttonBox.appendChild(button)

    // button = createNode("p", `Decrypt${ canCensor ? ' and Censor All' : ''}`, "button default-hidden")
    // button.id = "decrypt-all-button"
    // button.onclick = () => {
    //     data.forEach(async (user) => {
    //         ipcRenderer.invoke("decrypt-for-user", {...user, acensor: canCensor} )
    //     })
    // }
    // buttonBox.appendChild(button)

    header.appendChild(buttonBox)

    headerContainer.appendChild(header)
    table.appendChild(headerContainer)
    
    const tableBody = document.createElement("tbody")
    for (let user of data) {
        const tr = document.createElement("tr")

        tr.appendChild(createNode("td", user.name))

        console.log('timSince', user)
        const timeLabel = createNode("td", user.lastImageAddedOn == "N.A." ? "" : user.timeSince, "time-label")
        timeLabel.onmouseenter = () => {
            timeLabel.textContent = user.lastImageAddedOn == "N.A." ? "" : user.lastImageAddedOn
        }
        timeLabel.onmouseleave = () => {
            timeLabel.textContent = user.timeSince
        }
        timeLabel.style = "width: 140px;"
        tr.appendChild(timeLabel)

        tr.appendChild(createNode("td", user.numberInBucket == 0 ? "" : user.numberInBucket, "number"))
        
        const downloadedCount = createNode("td", user.downloadedCount == 0 ? "" : user.downloadedCount, "number clickable")
        downloadedCount.onclick = () => {
            ipcRenderer.invoke("open-in-explorer", "./encrypted/" + user.hashedKey.slice(0, 8))
        }
        tr.appendChild(downloadedCount)

        const decryptedCount = createNode("td", user.decryptedCount == 0 ? "" : user.decryptedCount, "number clickable")
        decryptedCount.onclick = () => {
            ipcRenderer.invoke("open-in-explorer", "./decrypted/" + user.hashedKey.slice(0, 8))
        }
        tr.appendChild(decryptedCount)

        const aCensoredCount = createNode("td", user.cleanedAutomatedCount == 0 ? "" : user.cleanedAutomatedCount, "number clickable")
        aCensoredCount.onclick = () => {
            ipcRenderer.invoke("open-in-explorer", "./cleaned_automated/" + user.hashedKey.slice(0, 8))
        }
        tr.appendChild(aCensoredCount)

        const finalCount = createNode("td", user.finalCount == 0 ? "" : user.finalCount, "number clickable")
        finalCount.onclick = () => {
            ipcRenderer.invoke("open-in-explorer", "./final/" + user.username)
        }
        tr.appendChild(finalCount)

        const actionContainer = createNode("td")
        let button = createNode("p", "Download", "button default-hidden")
        button.onclick = () => {
            console.log("downloading")
            ipcRenderer.invoke("download-images", user)
        }
        actionContainer.appendChild(button)

        button = createNode("p", "Decrypt", "button default-hidden")
        button.onclick = () => {
            console.log("decrypting user")
            ipcRenderer.invoke("decrypt-for-user", user)
        }
        actionContainer.appendChild(button)

        if (canCensor) {
            button = createNode("p", "Censor", "button default-hidden")
            button.onclick = () => {
                ipcRenderer.invoke("censor-for-user", user)
            }
            actionContainer.appendChild(button)
        }

        button = createNode("p", "Remove", "button default-hidden")
        button.onclick = () => {
            ipcRenderer.invoke("remove-user", user)
        }
        actionContainer.appendChild(button)

        button = createNode("p", "Clear Bucket", "button default-hidden")
        button.onclick = () => {
            console.log("clearing bucket")
            ipcRenderer.invoke("clear-bucket", user)
        }
        actionContainer.appendChild(button)

        tr.appendChild(actionContainer)
        tableBody.appendChild(tr)
    }

    table.appendChild(tableBody)
    mainBody.appendChild(table)
}

main()
