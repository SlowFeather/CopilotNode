// Debug script to test drawing manager functionality
console.log('Debug script loaded');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready in debug script');
    
    setTimeout(() => {
        console.log('=== DEBUG: Testing Drawing Manager ===');
        
        // Check if button exists
        const createBtn = document.getElementById('createDrawingBtn');
        console.log('Create button found:', !!createBtn);
        console.log('Create button element:', createBtn);
        
        // Check if modal exists
        const modal = document.getElementById('createDrawingModal');
        console.log('Modal found:', !!modal);
        console.log('Modal element:', modal);
        
        // Check DrawingManager class
        console.log('DrawingManager available:', typeof DrawingManager !== 'undefined');
        
        // Check if global instance exists
        console.log('Global drawingManager:', typeof window.drawingManager);
        
        if (createBtn && !createBtn.hasDebugListener) {
            console.log('Adding debug click listener to create button');
            createBtn.addEventListener('click', (e) => {
                console.log('=== BUTTON CLICKED (DEBUG) ===');
                console.log('Event:', e);
                console.log('Target:', e.target);
                
                if (window.drawingManager) {
                    console.log('Calling showCreateDrawingModal via global instance');
                    window.drawingManager.showCreateDrawingModal();
                } else {
                    console.log('No global drawingManager found, trying direct call');
                    if (typeof DrawingManager !== 'undefined') {
                        const tempManager = new DrawingManager();
                        tempManager.showCreateDrawingModal();
                    }
                }
            });
            createBtn.hasDebugListener = true;
        }
        
        // Test direct modal show/hide
        if (modal) {
            console.log('Testing direct modal manipulation');
            setTimeout(() => {
                console.log('Showing modal directly');
                modal.style.display = 'flex';
                
                setTimeout(() => {
                    console.log('Hiding modal directly');
                    modal.style.display = 'none';
                }, 2000);
            }, 1000);
        }
        
    }, 500);
});