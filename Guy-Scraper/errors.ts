export class SessionExpiredError extends Error {
  constructor() {
    super('Schoology session is no longer valid')
    this.name = 'SessionExpiredError'
  }
}

// Messages must never include page contents or cookies, since these errors reach server logs.
export class ScraperLayoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScraperLayoutError'
  }
}

export class StoreUnavailableError extends Error {
  constructor() {
    super("This computer's secure storage isn't available, so grades can't be saved safely")
    this.name = 'StoreUnavailableError'
  }
}

export class DataUnreadableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataUnreadableError'
  }
}
