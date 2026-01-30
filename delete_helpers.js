const fs = require('fs');
const path = 'c:\\steepanProjects\\sillobite-pos\\sillobite\\server\\routes.ts';

try {
    let content = fs.readFileSync(path, 'utf8');
    const lines = content.split('\n');

    // Find start of createOrderFromPaymentCallback
    const startIdx = lines.findIndex(l => l.includes('const createOrderFromPaymentCallback = async'));
    if (startIdx === -1) {
        console.log('Could not find createOrderFromPaymentCallback');
        process.exit(1);
    }

    // Find start of createOrderForFailedPayment
    const secondFuncIdx = lines.findIndex(l => l.includes('const createOrderForFailedPayment = async'));
    if (secondFuncIdx === -1) {
        console.log('Could not find createOrderForFailedPayment');
        process.exit(1);
    }

    // We want to delete from startIdx (and maybe comments above it) to the end of second function.
    // The first function usually has a comment above it.
    // "  // Helper function to create order from payment callback..."
    let deleteStart = startIdx;
    if (lines[startIdx - 1] && lines[startIdx - 1].includes('// Helper function to create order')) {
        deleteStart = startIdx - 1;
    }

    // The second function ends when the NEXT route starts.
    // "  // Check payment status" followed by "app.get..."
    const nextRouteIdx = lines.findIndex((l, i) => i > secondFuncIdx && l.includes('app.get("/api/payments/status/:merchantTransactionId"'));

    let deleteEnd = -1;
    if (nextRouteIdx !== -1) {
        // We want to keep the comment "// Check payment status" if it exists.
        // Scan back from nextRouteIdx
        let ptr = nextRouteIdx - 1;
        while (ptr > secondFuncIdx) {
            const line = lines[ptr].trim();
            if (line.includes('// Check payment status')) {
                // This is the start of next section, so we delete up to ptr - 1
                deleteEnd = ptr - 1;
                break;
            }
            if (line !== '') {
                // Found non-empty line before comment?
                // The function should end with "  };"
                if (line === '};') {
                    // We found end of function.
                    // But we want to delete up to here? No, up to the next section start.
                    // If we found "};" then the stuff between "};" and "app.get" is whitespace/comments?
                    // Actually, if we set deleteEnd to ptr-1 where ptr is the comment line, we remove whitespace between function and next comment.
                }
            }
            ptr--;
        }

        if (deleteEnd === -1) {
            // Fallback: delete up to nextRouteIdx - 1 (keeping whitespace maybe?)
            deleteEnd = nextRouteIdx - 1;
        }
    } else {
        // Fallback search
        console.log('Could not find next route to determine end');
        process.exit(1);
    }

    console.log(`Deleting from line ${deleteStart + 1} to ${deleteEnd + 1}`);

    // Splice out lines
    lines.splice(deleteStart, deleteEnd - deleteStart + 1);

    fs.writeFileSync(path, lines.join('\n'));
    console.log('Successfully deleted helpers');

} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
