/**
 * CreateItemDialog
 *
 * 建立項目對話框，用於建立 Milestone、Issue、Task
 * - 單一模式：輸入標題和描述，Enter 快速建立
 * - 批次模式：一次輸入多個標題（僅 Issue/Task 支援）
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BaseDialog } from './BaseDialog';
import './CreateItemDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {Function} props.onConfirm - 確認回調 (items: {title, description}[]) => Promise
 * @param {'milestone'|'issue'|'task'} props.itemType - 項目類型
 * @param {Object} props.parentTask - 父任務（用於顯示上下文）
 * @param {string} props.defaultTitle - 預設標題
 */
export function CreateItemDialog({
  isOpen,
  onClose,
  onConfirm,
  itemType = 'issue',
  parentTask,
  defaultTitle = '',
}) {
  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [batchTitles, setBatchTitles] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const titleInputRef = useRef(null);
  const batchInputRef = useRef(null);

  // Milestone 不支援批次模式
  const supportsBatchMode = itemType !== 'milestone';

  // 取得項目類型的顯示名稱
  const itemTypeName = useMemo(() => {
    switch (itemType) {
      case 'milestone': return 'Milestone';
      case 'issue': return 'Issue';
      case 'task': return 'Task';
      default: return 'Item';
    }
  }, [itemType]);

  // 重置表單
  useEffect(() => {
    if (isOpen) {
      setMode('single');
      setTitle(defaultTitle);
      setDescription('');
      setBatchTitles('');
      setError(null);
      setProcessing(false);
    }
  }, [isOpen, defaultTitle]);

  // 自動 focus
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (mode === 'single' && titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        } else if (mode === 'batch' && batchInputRef.current) {
          batchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, mode]);

  // 解析批次標題
  const parsedBatchItems = useMemo(() => {
    if (!batchTitles.trim()) return [];
    return batchTitles
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(title => ({ title, description: '' }));
  }, [batchTitles]);

  // 處理確認
  const handleConfirm = useCallback(async () => {
    setError(null);

    let items = [];

    if (mode === 'single') {
      if (!title.trim()) {
        setError('Please enter a title');
        return;
      }
      items = [{ title: title.trim(), description: description.trim() }];
    } else {
      if (parsedBatchItems.length === 0) {
        setError('Please enter at least one title');
        return;
      }
      items = parsedBatchItems;
    }

    setProcessing(true);

    try {
      await onConfirm(items);
      onClose();
    } catch (err) {
      console.error('[CreateItemDialog] Create failed:', err);
      setError(err.message || 'Failed to create items');
    } finally {
      setProcessing(false);
    }
  }, [mode, title, description, parsedBatchItems, onConfirm, onClose]);

  // Enter 鍵處理（僅在單一模式且 focus 在 title 輸入框時）
  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !processing && title.trim()) {
      e.preventDefault();
      handleConfirm();
    }
  }, [handleConfirm, processing, title]);

  // 建立按鈕文字
  const confirmButtonText = useMemo(() => {
    if (processing) return 'Creating...';
    if (mode === 'batch' && parsedBatchItems.length > 0) {
      return `Create ${parsedBatchItems.length} ${itemTypeName}${parsedBatchItems.length > 1 ? 's' : ''}`;
    }
    return `Create ${itemTypeName}`;
  }, [processing, mode, parsedBatchItems.length, itemTypeName]);

  const footer = (
    <>
      <button
        className="dialog-btn dialog-btn-secondary"
        onClick={onClose}
        disabled={processing}
        type="button"
      >
        Cancel
      </button>
      <button
        className="dialog-btn dialog-btn-primary"
        onClick={handleConfirm}
        disabled={processing || (mode === 'single' ? !title.trim() : parsedBatchItems.length === 0)}
        type="button"
      >
        {confirmButtonText}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Create ${itemTypeName}`}
      width={480}
      footer={footer}
      className="create-item-dialog"
      closeOnEscape={!processing}
      closeOnOverlayClick={!processing}
    >
      {/* 父任務上下文 */}
      {parentTask && (
        <div className="create-item-context">
          <span className="context-label">Under:</span>
          <span className="context-value">{parentTask.text}</span>
        </div>
      )}

      {/* 模式切換（僅 Issue/Task 支援） */}
      {supportsBatchMode && (
        <div className="create-item-mode-toggle">
          <button
            className={`mode-btn ${mode === 'single' ? 'active' : ''}`}
            onClick={() => setMode('single')}
            disabled={processing}
            type="button"
          >
            Single
          </button>
          <button
            className={`mode-btn ${mode === 'batch' ? 'active' : ''}`}
            onClick={() => setMode('batch')}
            disabled={processing}
            type="button"
          >
            Batch
          </button>
        </div>
      )}

      {/* 單一模式 */}
      {mode === 'single' && (
        <>
          <div className="dialog-form-group">
            <label htmlFor="create-item-title">Title</label>
            <input
              ref={titleInputRef}
              id="create-item-title"
              type="text"
              className="dialog-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder={`Enter ${itemTypeName.toLowerCase()} title`}
              disabled={processing}
            />
          </div>

          <div className="dialog-form-group">
            <label htmlFor="create-item-description">
              Description <span className="optional-label">(optional)</span>
            </label>
            <textarea
              id="create-item-description"
              className="dialog-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              disabled={processing}
              rows={3}
            />
          </div>

          <p className="dialog-hint">
            Press <kbd>Enter</kbd> to create quickly
          </p>
        </>
      )}

      {/* 批次模式 */}
      {mode === 'batch' && (
        <>
          <div className="dialog-form-group">
            <label htmlFor="create-item-batch">
              Titles <span className="hint-inline">(one per line)</span>
            </label>
            <textarea
              ref={batchInputRef}
              id="create-item-batch"
              className="dialog-textarea batch-textarea"
              value={batchTitles}
              onChange={(e) => setBatchTitles(e.target.value)}
              placeholder={`Enter ${itemTypeName.toLowerCase()} titles, one per line...\n\nExample:\nTask 1\nTask 2\nTask 3`}
              disabled={processing}
              rows={8}
            />
          </div>

          {/* 預覽 - 固定高度避免跳動 */}
          <div className="batch-preview">
            <div className="preview-header">
              <span className="preview-count">
                {parsedBatchItems.length > 0
                  ? `${parsedBatchItems.length} item${parsedBatchItems.length > 1 ? 's' : ''} to create:`
                  : 'Preview'
                }
              </span>
            </div>
            <div className="preview-list">
              {parsedBatchItems.length === 0 ? (
                <div className="preview-empty">
                  Enter titles above to preview
                </div>
              ) : (
                <>
                  {parsedBatchItems.slice(0, 5).map((item, index) => (
                    <div key={index} className="preview-item">
                      <span className="preview-index">{index + 1}.</span>
                      <span className="preview-title">{item.title}</span>
                    </div>
                  ))}
                  {parsedBatchItems.length > 5 && (
                    <div className="preview-more">
                      +{parsedBatchItems.length - 5} more...
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* 錯誤訊息 */}
      {error && <div className="dialog-error">{error}</div>}
    </BaseDialog>
  );
}

export default CreateItemDialog;
