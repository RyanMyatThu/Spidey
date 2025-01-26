class Lock {
    constructor() {
        this.locked = false;
        this.queue = [];
    }

    async acquire() {
        if (this.locked) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.locked = true;
    }

    release() {
        this.locked = false;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next(); 
        }
    }
}

async function insertDF(lock , term, documentId, sqlOperation){
    await lock.acquire();
    try{   
        console.log("Operating")
        await sqlOperation(term, documentId);
    } catch (error){

    } finally {
        lock.release();
    }

}

async function updateDomainCount(lock , domain, domainCount){
    await lock.acquire();
    try{
        const currentDomainCount = domainCount.get(domain) || 0;
        domainCount.set(domain, currentDomainCount + 1);
    } catch {

    } finally {
        lock.release();
    }
}

async function decreaseDomainCount(lock , domain, domainCount){
    await lock.acquire();
    try{
        const currentDomainCount = domainCount.get(domain) || 0;
        domainCount.set(domain, currentDomainCount - 1);
    } catch {

    } finally {
        lock.release();
    }
}

module.exports = {
    Lock,
    updateDomainCount,
    decreaseDomainCount,
    insertDF
};