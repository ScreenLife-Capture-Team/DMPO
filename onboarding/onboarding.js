const electron = require('electron');

const register = async () => {
    const name = document.getElementById("part-id").value;
    if (name == "") return;

	const res = await electron.ipcRenderer.invoke("register", { name })

    document.getElementById("inputs").style.visibility = "hidden";

    document.getElementById("code-image").src = res.qrcode;
    document.getElementById("verification-code").innerText = "Verification code: " + res.hashedKey.slice(0, 4);
}