import { useState } from 'react';

const FileSelector = ({ documentFiles, onConfirm, onCancel }) => {
    const [localSelectedFiles, setLocalSelectedFiles] = useState([]);

    return (
        <div className="simple-dropdown">
            <div className="dropdown-content">
                <div className="file-selection">
                    <p><strong>Chọn tài liệu ({documentFiles.length} files):</strong></p>
                    {documentFiles.map((file, index) => {
                        const fileName = file.name || file.filename;
                        const isSelected = localSelectedFiles.includes(fileName);
                        return (
                            <div key={index} className="file-selection-item">
                                <input
                                    type="checkbox"
                                    id={`file-${index}`}
                                    checked={isSelected}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setLocalSelectedFiles([...localSelectedFiles, fileName]);
                                        } else {
                                            setLocalSelectedFiles(localSelectedFiles.filter(f => f !== fileName));
                                        }
                                    }}
                                />
                                <label htmlFor={`file-${index}`} className="file-selection-name">
                                    {fileName}
                                </label>
                            </div>
                        );
                    })}
                </div>
                <div className="dropdown-buttons">
                    <button 
                        onClick={() => onConfirm(localSelectedFiles)}
                        disabled={localSelectedFiles.length === 0}
                        className="start-btn"
                    >
                        Bắt đầu ({localSelectedFiles.length})
                    </button>
                    <button 
                        onClick={() => {
                            const allFileNames = documentFiles.map(f => f.name || f.filename);
                            setLocalSelectedFiles(allFileNames);
                        }}
                        className="select-all"
                    >
                        Chọn tất cả
                    </button>
                    <button 
                        onClick={() => setLocalSelectedFiles([])}
                        className="clear-all"
                    >
                        Bỏ chọn
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileSelector;
