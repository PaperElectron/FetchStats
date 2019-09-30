/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project FetchStats
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

import {take, isNumber, gte, isNull, isFunction, includes, omit, clone} from 'lodash/fp'
let singleton = 0

export interface FetchStat {
  error: null | Error,
  status: null | number
  bodyText: null | string
  url: string,
  options: any
}

export interface GlobalStats {
  count: number,
  errors: number,
  ok: number,
  notOk: number,
  timeouts: number,
  lastStat: any
}

export interface ActiveStats {
  errors: any[],
  ok: any[],
  notOk: any[],
  timeouts: any[]
}

class _FetchStats {
  private handler: (globalStats: any, activeStats: any) => boolean
  private settings: {timeout: number, storageLimit: number}
  private globalStats: GlobalStats
  private activeStats: ActiveStats
  constructor(){
    this.resetStats()
    this.handler = (globalStats: GlobalStats, activeStats: ActiveStats) => false
    this.settings = {
      timeout: 2000,
      storageLimit: 20
    }
    this.globalStats = {
      count: 0,
      errors: 0,
      ok: 0,
      notOk: 0,
      timeouts: 0,
      lastStat: null
    }
  }

  async fetch(url, options = {}){
    return new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        let err = new Error('Request timed out.')
        this.addStat('timeouts', {
          status: null,
          bodyText: null,
          error: err,
          url,
          options
        })
        reject(err)
      }, this.settings.timeout)

      fetch(url, options)
        .then(async (response: Response) => {
          if(response.ok){
            this.addStat('ok', {
              status: response.status,
              bodyText: null,
              error: null,
              url,
              options
            })
            return resolve(response)
          }
          let clonedResponse = clone(response)
          this.addStat('notOk', {
            status: response.status,
            bodyText: await clonedResponse.text(),
            error: null,
            url,
            options
          })
          return resolve(response)
        })
        .catch((err) => {
          this.addStat('error', {
            status: null,
            bodyText: null,
            error: err,
            url,
            options
          })
          return reject(err)
        })
        .finally(async () => {
          clearTimeout(timer)
          try {
            let r = await this.handler(this.globalStats, this.activeStats)
            if(r){
              this.resetStats()
            }
          }
          catch(err){
            console.log('FetchStats handler threw with error:')
            console.log(err)
            console.log('It will be ignored.')
          }
        })
    })

  }

  addStat(type: string, stat: FetchStat){
    if(stat.options.body){
      stat.options = omit('body', stat.options)
    }
    this.globalStats.lastStat = stat
    this.globalStats.count = this.globalStats.count + 1
    let t = includes(type, ['errors', 'timeouts', 'ok', 'notOk']) ? type : (()=>{throw new Error(`${type} is incorrect`)})()
    this.globalStats[t] = this.globalStats[t] + 1
    this.activeStats[t].unshift(stat)
    this.activeStats[t] = take(this.settings.storageLimit, this.activeStats[t])


  }
  getStats(){
    return this.activeStats
  }
  resetStats(){
    this.activeStats = {
      timeouts: [],
      errors: [],
      ok: [],
      notOk: []
    }
  }
  configure({timeout, storageLimit}){
    this.settings.timeout = isNumber(timeout) && gte(100, timeout) ? timeout : this.settings.timeout
    this.settings.storageLimit = isNumber(storageLimit) && gte(100, storageLimit) ? storageLimit : this.settings.storageLimit
  }

  addHandler(handler: (globalStats: GlobalStats, activeStats: ActiveStats)=> boolean){
    if(isFunction(handler)){
      this.handler = handler
    }
  }

}


export const FetchStats = new _FetchStats()