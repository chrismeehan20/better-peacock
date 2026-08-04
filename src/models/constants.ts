import * as vscode from 'vscode';

export const extensionShortName = 'peacock';
export const extensionId = 'chrismeehan20.better-peacock';
export const favoriteColorSeparator = '->';

export const docsUri = vscode.Uri.parse('https://github.com/chrismeehan20/better-peacock#readme');

// Matches the default inactive alpha in VS Code of 0x99
// represented in 0-1 range for tinycolor.setAlpha()
export const inactiveElementAlpha = 0x99 / 0xff;

export const defaultAmountToDarkenLighten = 10;

export const defaultSaturation = 0.5;

// Percent of the workspace color laid over the side bar and tab strip.
// Low enough that the theme's own foreground colors stay readable,
// high enough to read as a distinct window in Mission Control.
// sideBar.background also paints the secondary side bar (chat/aux panels),
// so anything much above ~10 washes out text across half the window.
export const defaultSideBarTintIntensity = 5;

export const azureBlue = '#007fff';
export const peacockGreen = '#42b883';

export const peacockMementos = {
  favoritesVersion: `${extensionShortName}.favoritesVersion`,
};

export const timeout = async (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

export const isObjectEmpty = (o: object | undefined) =>
  typeof o === 'object' && Object.keys(o).length === 0;
