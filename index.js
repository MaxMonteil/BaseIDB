import { openDB } from "idb";

export class StoresIdb {
  static _version = 1;
  static _freshStart = true;
  static _checking = false;

  static _dbCheck = null;

  // When the page gets reloaded, we need to update the static version.
  // whether the db has stores or not, this ensures we try to open with the latest version in getStore()
  // this does result in db versions starting at 1, not 0
  _checkDbVersion(dbName) {
    return new Promise((resolve) => {
      openDB(dbName).then((db) => {
        StoresIdb._version = db.version;
        db.close(); // always close db
        StoresIdb._freshStart = false;
        resolve();
      });
    });
  }

  constructor(name, store) {
    this._name = name;
    this._store = store;

    if (StoresIdb._freshStart && !StoresIdb._checking) {
      StoresIdb._checking = true;
      StoresIdb._dbCheck = this._checkDbVersion(this._name);
    }
  }

  // stores are actually created here instead of in the constructor,
  // this prevents random stores from being created right at app launch when the user might not even be logged in
  async getStore(store = this._store) {
    await StoresIdb._dbCheck;

    const db = await openDB(this._name, StoresIdb._version, {
      // first time db is opened (outisde of check), create the store
      upgrade: (db) => db.createObjectStore(store),
    });

    if (db.objectStoreNames.contains(store)) return db;

    // always close db to avoid blocking transactions on other stores
    db.close();

    StoresIdb._version += 1;
    return await openDB(this._name, StoresIdb._version, {
      // this time we're creating a new store
      upgrade: (db) => db.createObjectStore(store),
    });
  }

  // this function is for brevity,
  // we always get the store then close the db
  // it does mean we need to use strings for function names which sucks for autocompletion
  _autoclose(func, ...args) {
    return (async () => {
      const db = await this.getStore();
      const r = await db[func](...args);
      db.close(); // always close db
      return r;
    })();
  }

  async exists(id) {
    const keys = await this._autoclose("getAllKeys", this._store);
    return keys.includes(id);
  }

  async getValueByID(key) {
    return await this._autoclose("get", this._store, key);
  }

  async getAllValues() {
    return await this._autoclose("getAll", this._store);
  }

  async saveValue(key, val) {
    return await this._autoclose("put", this._store, val, key);
  }

  async deleteValueByID(key) {
    return await this._autoclose("delete", this._store, key);
  }

  async clear() {
    return await this._autoclose("clear", this._store);
  }

  async keys() {
    return await this._autoclose("getAllKeys", this._store);
  }
}
