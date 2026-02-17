
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/lottiefiles/Food.json');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);

    let bgFound = false;

    // Function to search and modify background layer
    function modifyBackground(layers) {
        if (!layers) return;

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.nm === 'BG') {
                console.log('Found BG layer');
                // Search for shapes/fills
                if (layer.shapes) {
                    layer.shapes.forEach(shape => {
                        // Check top level group items
                        if (shape.it) {
                            shape.it.forEach(item => {
                                if (item.ty === 'fl') { // Fill
                                    console.log('Found Fill, changing alpha to 0');
                                    if (item.c && item.c.k) {
                                        // Check if color is roughly white [1,1,1,1]
                                        const c = item.c.k;
                                        if (Array.isArray(c) && c.length >= 3 && c[0] >= 0.9 && c[1] >= 0.9 && c[2] >= 0.9) {
                                            // Set alpha to 0. Format is [r, g, b, a]
                                            // Usually lottie colors are [r,g,b,a]
                                            if (c.length === 4) {
                                                item.c.k[3] = 0;
                                                bgFound = true;
                                            } else if (c.length === 3) {
                                                // If 3, it might just be RGB. But Lottie fill often has opacity 'o' property separately?
                                                // Let's check 'o' property of fill.
                                                // Actually, `c.k` is color. Opacity is `o`.
                                                // Wait, the script output said "Fill Color: 1 1 1 1".
                                                // So it's 4 components.
                                            }
                                        }
                                    }
                                }
                                // Also check groups inside BG
                                if (item.ty === 'gr') {
                                    if (item.it) {
                                        item.it.forEach(sub => {
                                            if (sub.ty === 'fl') {
                                                console.log('Found Fill in Group, changing alpha to 0');
                                                const c = sub.c.k;
                                                if (Array.isArray(c) && c.length === 4) {
                                                    sub.c.k[3] = 0;
                                                    bgFound = true;
                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
            }
        }
    }

    modifyBackground(json.layers);
    // Also check assets for precomps if main layers don't have it (but we found it in main layers in script)
    // modifyBackground(json.assets...);

    if (bgFound) {
        fs.writeFileSync(filePath, JSON.stringify(json), 'utf8'); // Keeps it compact by default? No, usually one line? 
        // JSON.stringify(json) creates a one-line string (minified)
        console.log('Successfully modified Food.json');
    } else {
        console.log('BG layer or white fill not found/modified');
    }

} catch (err) {
    console.error('Error:', err);
}
