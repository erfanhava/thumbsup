class PDFEditor {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.canvas = document.getElementById('pdfCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scale = 1.5;
        this.annotations = [];
        this.formFields = [];
        this.undoStack = [];
        this.redoStack = [];
        this.isDrawing = false;
        this.currentTool = null;
        this.currentColor = '#000000';
        this.fontSize = 12;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadBlankCanvas();
        this.setupDrawing();
    }
    
    setupEventListeners() {
        // File Upload
        document.getElementById('pdfInput').addEventListener('change', (e) => {
            this.loadPDF(e.target.files[0]);
        });
        
        // Drag & Drop
        const dropArea = document.getElementById('dropArea');
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#e63946';
        });
        
        dropArea.addEventListener('dragleave', () => {
            dropArea.style.borderColor = 'var(--border-color)';
        });
        
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = 'var(--border-color)';
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                this.loadPDF(file);
            } else {
                this.showToast('Please upload a PDF file', 'error');
            }
        });
        
        // Templates
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const template = card.dataset.template;
                this.loadTemplate(template);
            });
        });
        
        // Tool Buttons
        document.getElementById('addTextBtn').addEventListener('click', () => {
            this.setTool('text');
        });
        
        document.getElementById('addSignatureBtn').addEventListener('click', () => {
            this.setTool('signature');
        });
        
        document.getElementById('highlightBtn').addEventListener('click', () => {
            this.setTool('highlight');
        });
        
        document.getElementById('drawBtn').addEventListener('click', () => {
            this.setTool('draw');
        });
        
        document.getElementById('eraserBtn').addEventListener('click', () => {
            this.setTool('eraser');
        });
        
        // Color & Font Controls
        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
        });
        
        document.getElementById('fontSize').addEventListener('change', (e) => {
            this.fontSize = parseInt(e.target.value);
        });
        
        // Undo/Redo/Clear
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        
        // Page Navigation
        document.getElementById('prevPage').addEventListener('click', () => this.prevPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
        
        // Save & Export
        document.getElementById('saveBtn').addEventListener('click', () => this.savePDF());
        document.getElementById('printBtn').addEventListener('click', () => window.print());
        document.getElementById('shareBtn').addEventListener('click', () => this.sharePDF());
        document.getElementById('newDocBtn').addEventListener('click', () => this.newDocument());
        
        // Form Fields
        document.getElementById('addFieldBtn').addEventListener('click', () => this.showAddFieldModal());
        document.getElementById('saveFieldBtn').addEventListener('click', () => this.addFormField());
        document.getElementById('cancelFieldBtn').addEventListener('click', () => this.hideModal());
        
        // Modal Close on Outside Click
        document.getElementById('addFieldModal').addEventListener('click', (e) => {
            if (e.target.id === 'addFieldModal') {
                this.hideModal();
            }
        });
        
        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'z':
                        if (e.shiftKey) this.redo();
                        else this.undo();
                        e.preventDefault();
                        break;
                    case 'y':
                        this.redo();
                        e.preventDefault();
                        break;
                    case 's':
                        this.savePDF();
                        e.preventDefault();
                        break;
                }
            }
        });
    }
    
    loadBlankCanvas() {
        this.canvas.width = 800;
        this.canvas.height = 1131; // A4 ratio
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#666';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Upload a PDF or choose a template', this.canvas.width/2, this.canvas.height/2);
    }
    
    async loadPDF(file) {
        if (!file) return;
        
        try {
            this.showLoading(true);
            
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            
            document.getElementById('editorSection').style.display = 'block';
            document.getElementById('saveBtn').disabled = false;
            
            await this.renderPage();
            this.updatePageInfo();
            this.showToast('PDF loaded successfully!');
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showToast('Error loading PDF file', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadTemplate(template) {
        let templatePDF;
        
        switch(template) {
            case 'invoice':
                templatePDF = await this.generateInvoiceTemplate();
                break;
            case 'application':
                templatePDF = await this.generateApplicationTemplate();
                break;
            case 'contract':
                templatePDF = await this.generateContractTemplate();
                break;
            default:
                this.loadBlankCanvas();
                return;
        }
        
        this.pdfDoc = templatePDF;
        this.totalPages = 1;
        this.currentPage = 1;
        
        document.getElementById('editorSection').style.display = 'block';
        document.getElementById('saveBtn').disabled = false;
        
        await this.renderPage();
        this.updatePageInfo();
        this.showToast('Template loaded successfully!');
    }
    
    async renderPage() {
        if (!this.pdfDoc) return;
        
        try {
            const page = await this.pdfDoc.getPage(this.currentPage);
            const viewport = page.getViewport({scale: this.scale});
            
            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            // Re-apply annotations
            this.redrawAnnotations();
            
        } catch (error) {
            console.error('Error rendering page:', error);
            this.showToast('Error rendering PDF page', 'error');
        }
    }
    
    setTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        event?.target.classList.add('active');
        
        // Setup tool behavior
        switch(tool) {
            case 'text':
                this.setupTextTool();
                break;
            case 'signature':
                this.setupSignatureTool();
                break;
            case 'draw':
                this.setupDrawingTool();
                break;
        }
        
        this.showToast(`${tool.charAt(0).toUpperCase() + tool.slice(1)} tool activated`);
    }
    
    setupDrawing() {
        let drawing = false;
        let lastX = 0;
        let lastY = 0;
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.currentTool !== 'draw' && this.currentTool !== 'eraser') return;
            
            drawing = true;
            const rect = this.canvas.getBoundingClientRect();
            lastX = e.clientX - rect.left;
            lastY = e.clientY - rect.top;
            
            this.saveState();
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (!drawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.ctx.beginPath();
            this.ctx.moveTo(lastX, lastY);
            this.ctx.lineTo(x, y);
            this.ctx.strokeStyle = this.currentTool === 'eraser' ? 'white' : this.currentColor;
            this.ctx.lineWidth = this.currentTool === 'eraser' ? 10 : this.fontSize / 4;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
            
            lastX = x;
            lastY = y;
        });
        
        this.canvas.addEventListener('mouseup', () => {
            drawing = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            drawing = false;
        });
    }
    
    setupTextTool() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const text = prompt('Enter text:');
            if (text) {
                this.saveState();
                
                this.ctx.font = `${this.fontSize}px ${document.getElementById('fontFamily').value}`;
                this.ctx.fillStyle = this.currentColor;
                this.ctx.fillText(text, x, y);
                
                this.annotations.push({
                    type: 'text',
                    x, y,
                    text,
                    font: this.ctx.font,
                    color: this.currentColor
                });
            }
        }, {once: true});
    }
    
    setupSignatureTool() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Draw Your Signature</h3>
                <canvas id="signatureCanvas" width="400" height="200" 
                        style="border: 2px solid var(--border-color); background: white; cursor: crosshair;"></canvas>
                <div class="modal-actions">
                    <button id="clearSignature" class="btn-secondary">Clear</button>
                    <button id="cancelSignature" class="btn-secondary">Cancel</button>
                    <button id="saveSignature" class="btn-primary">Insert</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        const sigCanvas = document.getElementById('signatureCanvas');
        const sigCtx = sigCanvas.getContext('2d');
        let drawing = false;
        
        sigCanvas.addEventListener('mousedown', (e) => {
            drawing = true;
            const rect = sigCanvas.getBoundingClientRect();
            sigCtx.beginPath();
            sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        });
        
        sigCanvas.addEventListener('mousemove', (e) => {
            if (!drawing) return;
            const rect = sigCanvas.getBoundingClientRect();
            sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            sigCtx.strokeStyle = '#000';
            sigCtx.lineWidth = 2;
            sigCtx.lineCap = 'round';
            sigCtx.stroke();
        });
        
        sigCanvas.addEventListener('mouseup', () => drawing = false);
        
        document.getElementById('clearSignature').addEventListener('click', () => {
            sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        });
        
        document.getElementById('cancelSignature').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.getElementById('saveSignature').addEventListener('click', () => {
            const signature = sigCanvas.toDataURL();
            this.insertSignature(signature);
            document.body.removeChild(modal);
        });
    }
    
    insertSignature(signatureData) {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.saveState();
            
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, x, y, 150, 60);
                this.annotations.push({
                    type: 'signature',
                    x, y,
                    width: 150,
                    height: 60,
                    data: signatureData
                });
            };
            img.src = signatureData;
        }, {once: true});
    }
    
    redrawAnnotations() {
        this.annotations.forEach(annotation => {
            switch(annotation.type) {
                case 'text':
                    this.ctx.font = annotation.font;
                    this.ctx.fillStyle = annotation.color;
                    this.ctx.fillText(annotation.text, annotation.x, annotation.y);
                    break;
                case 'signature':
                    const img = new Image();
                    img.src = annotation.data;
                    img.onload = () => {
                        this.ctx.drawImage(img, annotation.x, annotation.y, annotation.width, annotation.height);
                    };
                    break;
            }
        });
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage();
            this.updatePageInfo();
        }
    }
    
    nextPage() {
        if (this.pdfDoc && this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderPage();
            this.updatePageInfo();
        }
    }
    
    updatePageInfo() {
        document.getElementById('pageInfo').textContent = 
            `Page ${this.currentPage} of ${this.totalPages}`;
        
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= this.totalPages;
    }
    
    saveState() {
        this.undoStack.push(this.canvas.toDataURL());
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(this.canvas.toDataURL());
            const state = this.undoStack.pop();
            this.restoreState(state);
            this.showToast('Undo successful');
        }
    }
    
    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(this.canvas.toDataURL());
            const state = this.redoStack.pop();
            this.restoreState(state);
            this.showToast('Redo successful');
        }
    }
    
    restoreState(state) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = state;
    }
    
    clearAll() {
        if (confirm('Are you sure you want to clear all annotations?')) {
            this.saveState();
            this.annotations = [];
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.renderPage();
            this.showToast('All annotations cleared');
        }
    }
    
    async savePDF() {
        if (!this.pdfDoc) {
            this.showToast('No PDF loaded', 'error');
            return;
        }
        
        try {
            this.showLoading(true);
            
            // Create a new PDF with annotations
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            
            // For simplicity, we'll export the canvas as an image
            // In a real implementation, you'd want to preserve the PDF structure
            const imgData = this.canvas.toDataURL('image/jpeg', 1.0);
            
            // Calculate dimensions
            const imgWidth = 210; // A4 width in mm
            const imgHeight = (this.canvas.height * imgWidth) / this.canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
            
            // Save the PDF
            pdf.save(`edited-document-${new Date().getTime()}.pdf`);
            
            this.showToast('PDF downloaded successfully!');
            
        } catch (error) {
            console.error('Error saving PDF:', error);
            this.showToast('Error saving PDF', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    sharePDF() {
        if (!this.pdfDoc) {
            this.showToast('No PDF loaded', 'error');
            return;
        }
        
        if (navigator.share) {
            // Convert canvas to blob
            this.canvas.toBlob(async (blob) => {
                const file = new File([blob], 'edited-document.pdf', { type: 'application/pdf' });
                
                try {
                    await navigator.share({
                        title: 'Edited PDF Document',
                        text: 'Check out this edited PDF!',
                        files: [file]
                    });
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        this.showToast('Share cancelled or failed', 'error');
                    }
                }
            }, 'application/pdf');
        } else {
            // Fallback: Download and prompt to share
            this.savePDF();
            this.showToast('Download the file to share it manually');
        }
    }
    
    newDocument() {
        if (confirm('Are you sure? All unsaved changes will be lost.')) {
            this.pdfDoc = null;
            this.currentPage = 1;
            this.totalPages = 1;
            this.annotations = [];
            this.undoStack = [];
            this.redoStack = [];
            
            document.getElementById('editorSection').style.display = 'none';
            document.getElementById('saveBtn').disabled = true;
            this.loadBlankCanvas();
            this.updatePageInfo();
            
            this.showToast('New document created');
        }
    }
    
    showAddFieldModal() {
        document.getElementById('addFieldModal').style.display = 'flex';
    }
    
    hideModal() {
        document.getElementById('addFieldModal').style.display = 'none';
    }
    
    addFormField() {
        const type = document.getElementById('fieldType').value;
        const label = document.getElementById('fieldLabel').value || `Field ${this.formFields.length + 1}`;
        
        if (!label.trim()) {
            this.showToast('Please enter a field label', 'error');
            return;
        }
        
        const field = {
            id: `field_${Date.now()}`,
            type,
            label,
            value: '',
            page: this.currentPage,
            x: 50,
            y: 50
        };
        
        this.formFields.push(field);
        this.renderFormFieldsList();
        this.hideModal();
        
        // Clear inputs
        document.getElementById('fieldLabel').value = '';
        
        this.showToast('Form field added');
    }
    
    renderFormFieldsList() {
        const container = document.getElementById('formFieldsList');
        container.innerHTML = '';
        
        this.formFields
            .filter(field => field.page === this.currentPage)
            .forEach(field => {
                const div = document.createElement('div');
                div.className = 'form-field-item';
                div.draggable = true;
                div.dataset.id = field.id;
                
                div.innerHTML = `
                    <div class="field-header">
                        <span class="field-label">${field.label}</span>
                        <span class="field-type">${field.type}</span>
                    </div>
                    <input type="${field.type === 'date' ? 'date' : 'text'}" 
                           class="field-input" 
                           value="${field.value}"
                           placeholder="Enter ${field.label.toLowerCase()}">
                `;
                
                // Add event listeners
                const input = div.querySelector('.field-input');
                input.addEventListener('input', (e) => {
                    field.value = e.target.value;
                });
                
                container.appendChild(div);
            });
    }
    
    async generateInvoiceTemplate() {
        // Create a simple invoice template
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Add title
        pdf.setFontSize(24);
        pdf.text('INVOICE', 105, 20, { align: 'center' });
        
        // Add invoice details
        pdf.setFontSize(12);
        pdf.text('Invoice #: INV-2023-001', 20, 40);
        pdf.text('Date: ' + new Date().toLocaleDateString(), 20, 50);
        
        // Add table headers
        pdf.text('Description', 20, 70);
        pdf.text('Quantity', 100, 70);
        pdf.text('Price', 140, 70);
        pdf.text('Total', 180, 70);
        
        // Add sample items
        const items = [
            { desc: 'Web Design Service', qty: 1, price: 500 },
            { desc: 'Hosting (Monthly)', qty: 3, price: 25 },
            { desc: 'Domain Registration', qty: 1, price: 15 }
        ];
        
        let y = 80;
        items.forEach(item => {
            pdf.text(item.desc, 20, y);
            pdf.text(item.qty.toString(), 100, y);
            pdf.text('$' + item.price, 140, y);
            pdf.text('$' + (item.qty * item.price), 180, y);
            y += 10;
        });
        
        // Add total
        y += 10;
        pdf.setFontSize(14);
        pdf.text('Total: $590', 20, y);
        
        // Add signature line
        y += 30;
        pdf.text('Authorized Signature:', 20, y);
        pdf.line(80, y, 150, y);
        
        return pdf;
    }
    
    generateApplicationTemplate() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        pdf.setFontSize(20);
        pdf.text('JOB APPLICATION FORM', 105, 20, { align: 'center' });
        
        pdf.setFontSize(12);
        let y = 40;
        
        const fields = [
            'Full Name:',
            'Email Address:',
            'Phone Number:',
            'Position Applied For:',
            'Previous Experience:',
            'Education:',
            'Skills:',
            'Availability:'
        ];
        
        fields.forEach(field => {
            pdf.text(field, 20, y);
            pdf.line(60, y - 3, 180, y - 3);
            y += 15;
        });
        
        return pdf;
    }
    
    generateContractTemplate() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        pdf.setFontSize(18);
        pdf.text('SIMPLE AGREEMENT CONTRACT', 105, 20, { align: 'center' });
        
        pdf.setFontSize(11);
        let y = 40;
        
        const paragraphs = [
            'This Agreement is made on ' + new Date().toLocaleDateString() + ' between:',
            '',
            'Party A: _______________________________________________________',
            '',
            'Party B: _______________________________________________________',
            '',
            '1. TERM: This agreement shall commence on the date first written above.',
            '',
            '2. SCOPE: The parties agree to cooperate in good faith.',
            '',
            '3. CONFIDENTIALITY: Both parties agree to maintain confidentiality.',
            '',
            '4. TERMINATION: This agreement may be terminated by either party.',
            '',
            'IN WITNESS WHEREOF, the parties have executed this agreement.',
            '',
            'Party A Signature: ________________________ Date: _______________',
            '',
            'Party B Signature: ________________________ Date: _______________'
        ];
        
        paragraphs.forEach(para => {
            pdf.text(para, 20, y, { maxWidth: 170 });
            y += para ? 8 : 4;
        });
        
        return pdf;
    }
    
    showLoading(show) {
        // Implement loading indicator
        if (show) {
            // Show loading
        } else {
            // Hide loading
        }
    }
    
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const editor = new PDFEditor();
    window.pdfEditor = editor; // Make accessible for debugging
});