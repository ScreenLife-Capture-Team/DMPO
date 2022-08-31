## DMPO: Data management and participant onboarding system

This tool was created to aid in the facilitation of ScreenLife Capture studies. It was developed using Electron, and to be run through Electron directly.

#### Build and run with Electron.

##### Prerequisites

- Knowledge on using the version-control tool Git.
- Basic knowledge on using `npm`.

##### Instructions to run with Electron

1. Clone this repository to your local device using the [Git](https://git-scm.com/) GUI tool. Go to "Clone Existing Repository", set the source location as "https://github.com/ScreenLife-Capture-Team/DMPO" and a "Target Directory" (e.g. folder) of your choice.
2. Open Windows Powershell and set the working directory to the folder in which the DMPO is stored. Instructions can be found [here](https://docs.microsoft.com/en-us/powershell/scripting/samples/managing-current-location?view=powershell-7.2). 
3. Use the command `npm install` to install dependencies.
4. Use the command `npm start` or `electron .` to start the program.

Note: Please ensure that the bucket_key.json and settings.json files have been included and updated in your DMPO folder.

##### The information on how to use the automated censoring scripts can be found here:
https://github.com/ScreenLife-Capture-Team/censoring-scripts
The `censoring-scripts` folder needs to be in the same folder as this repository, as demonstrated below:

```
parent-folder
 - DMPO
 - censoring-scripts
```

If this folder is not detected, automated censoring options will not be present in the DMPO software.

Shield: [![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
