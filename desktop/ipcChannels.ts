/** Nomes dos canais IPC entre o processo main e a janela (renderer), compartilhados pra não duplicar a string em cada lado. */
export const IpcChannels = {
  packagesList: "packages:list",
  packagesRefresh: "packages:refresh",
  packagesRemove: "packages:remove",
} as const;
