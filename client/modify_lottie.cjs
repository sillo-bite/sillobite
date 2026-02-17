
const fs = require('fs');
const path = require('path');

// Ensure correct path relative to this script
const filePath = path.join(__dirname, 'public/lottiefiles/Food.json');

try {
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }

    const data = fs.readFileSync(filePath, 'utf8');
    let json;
    try {
        json = JSON.parse(data);
    } catch (e) {
        console.error('Error parsing JSON:', e.message);
        process.exit(1);
    }

    let bgFound = false;

    function modifyBackground(layers) {
        if (!layers) return;

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.nm === 'BG') {
                console.log('Found BG layer');
                if (layer.shapes) {
                    layer.shapes.forEach(shape => {
                        if (shape.it) {
                            shape.it.forEach(item => {
                                if (item.ty === 'fl') {
                                    console.log('Found Fill, changing alpha to 0');
                                    if (item.c && item.c.k) {
                                        // Ensure it is array
                                        if (Array.isArray(item.c.k)) {
                                            // If length 4 (RGBA), set A to 0
                                            if (item.c.k.length === 4) {
                                                item.c.k[3] = 0;
                                                bgFound = true;
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            }
        }
    }

    if (json.layers) {
        modifyBackground(json.layers);
    }

    if (bgFound) {
        fs.writeFileSync(filePath, JSON.stringify(json), 'utf8');
        console.log('Successfully modified Food.json');
    } else {
        console.log('BG layer not found or not modified');
    }

} catch (err) {
    console.error('Error:', err);
}
