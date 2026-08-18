import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "./ipcChannels";

contextBridge.exposeInMainWorld("api", {
  listPackages: () => ipcRenderer.invoke(IpcChannels.packagesList),
  refreshPackages: () => ipcRenderer.invoke(IpcChannels.packagesRefresh),
  removePackage: (code: string) => ipcRenderer.invoke(IpcChannels.packagesRemove, code),
});
