import { postToServerFunction } from "../lib/serverApi";

// NIVEAU 2: LinkedIn Check
export async function verifyLinkedIn(userId: string, linkedinUrl: string, providerName: string): Promise<any> {
    void userId;

    try {
        const result = await postToServerFunction<any>('ai-verify-linkedin', {
            linkedinUrl,
            providerName
        });
        
        let resultData;
        try {
            resultData = result;
        } catch(e) {
            console.error("Parse error", result);
            resultData = { score: 0, status: 'REJECTED', reason: 'AI Response error' };
        }
        
        return resultData;
    } catch(err) {
        console.error('LinkedIn verify error', err);
        throw err;
    }
}

// NIVEAU 3: Address Live-Check
export async function verifyAddressLive(userId: string, imageDataUrl: string, expectedAddress: string, expectedName: string): Promise<any> {
    void userId;

    try {
        let resultData;
        try {
            resultData = await postToServerFunction<any>('ai-verify-address-live', {
                imageDataUrl,
                expectedAddress,
                expectedName
            });
            if (resultData.confidence >= 50 && resultData.confidence <= 70 && resultData.status !== 'APPROVED') {
                resultData.status = 'PENDING_MANUAL';
            }
        } catch(e) {
            resultData = { status: 'REJECTED', confidence: 0, reason: 'Parse error', extracted_data: {} };
        }

        return resultData;
    } catch(err) {
        console.error('Address verify error', err);
        throw err;
    }
}
