## DMPO: Data management and participant onboarding system

This tool was created to aid in the facilitation of ScreenLife Capture studies. It was developed using Electron, and can either be run through Electron directly, or through a pre-packaged .exe file.

#### Build and run with Electron.

##### Prerequisites

- Knowledge on using the version-control tool Git.
- Basic knowledge on using `npm`.

##### Instructions to run with Electron

1. Clone the repository to your local device.
2. Use the command `npm install` to install dependencies.
3. Add the required credential file (bucket_key.json).
4. Duplicate / Rename the `default-settings.json` file to `settings.json`, and modify the file as necessary.
5. Use the command `npm start` or `electron .` to start the program.

##### The information on how to use the automated censoring scripts can be found here:
https://github.com/ScreenLife-Capture-Team/censoring-scripts
The `censoring-scripts` folder needs to be in the same folder as this repository, as demonstrated below:

```
parent-folder
 - DMPO
 - censoring-scripts
```

If this folder is not detected, automated censoring options will not be present in the DMPO software.

##### To download the pre-packaged .exe, use the download link below.

[Windows 64-bit](https://drive.google.com/file/d/1jv1pKAYxMObT7EVg7w1mFMb2Ee092JN6/view?usp=sharing)

