// src/components/SharedEditor/fields/DescriptionField.jsx
/**
 * DescriptionField
 *
 * TipTap WYSIWYG editor for task description (GitLab markdown).
 * Saves on explicit "Save" button click. Shows Save/Discard buttons when dirty.
 *
 * TipTap reads/writes HTML internally. We convert from/to markdown using
 * the task's `details` field (which stores raw GitLab markdown).
 *
 * Caveat: TipTap renders standard markdown. GitLab-specific syntax (task lists,
 * @mentions, #issue references) will not render specially — they pass through as text.
 * This is acceptable for Phase 1 and can be improved with TipTap extensions later.
 */
import { useCallback, useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useGitLabData } from '../../../contexts/GitLabDataContext';
import { useSharedEditor } from '../../../contexts/SharedEditorContext';
import './DescriptionField.css';

/**
 * Convert GitLab markdown to TipTap-compatible HTML.
 * Handles common markdown syntax: headings, bold, italic, code, lists.
 * GitLab-specific syntax (task lists, mentions, issue refs) passes through as text.
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h3) { result.push(`<h3>${inlineMarkdown(h3[1])}</h3>`); i++; continue; }
    if (h2) { result.push(`<h2>${inlineMarkdown(h2[1])}</h2>`); i++; continue; }
    if (h1) { result.push(`<h1>${inlineMarkdown(h1[1])}</h1>`); i++; continue; }

    // Code block (``` fenced)
    if (line.match(/^```/)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      result.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Unordered list
    if (line.match(/^[*-] /)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^[*-] /)) {
        listItems.push(`<li>${inlineMarkdown(lines[i].slice(2))}</li>`);
        i++;
      }
      result.push(`<ul>${listItems.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        listItems.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      result.push(`<ol>${listItems.join('')}</ol>`);
      continue;
    }

    // Empty line — skip entirely. Block-level elements (headings, lists, code)
    // already have margins; extra <p><br></p> only adds unwanted visual gaps.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph
    result.push(`<p>${inlineMarkdown(line)}</p>`);
    i++;
  }

  return result.join('');
}

/** Escape HTML special chars (for code blocks) */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert inline markdown (bold, italic, code) to HTML.
 *  MUST escape HTML first to prevent XSS from user-supplied issue content. */
function inlineMarkdown(text) {
  // Escape raw HTML before applying markdown substitutions so that issue
  // descriptions containing <script> or similar are never injected as DOM.
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

/**
 * Convert TipTap HTML back to GitLab markdown.
 * Must handle block-level elements before stripping remaining tags.
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  return html
    // Code blocks (pre > code)
    .replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi, (_, _attr, code) =>
      '```\n' + code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') + '\n```'
    )
    // Headings (must come before generic tag strip)
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    // Lists
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) =>
      inner.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    )
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
      let n = 0;
      return inner.replace(/<li[^>]*>(.*?)<\/li>/gi, (__, content) => `${++n}. ${content}\n`);
    })
    // Inline formatting
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Paragraphs and breaks
    .replace(/<p><br\/?><\/p>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
    .replace(/<br\/?>/gi, '\n')
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    .trim();
}

function ToolbarButton({ onClick, active, children, title }) {
  return (
    <button
      type="button"
      className={`desc-toolbar-btn${active ? ' active' : ''}`}
      onMouseDown={(e) => {
        // Prevent editor blur when clicking toolbar
        e.preventDefault();
        onClick();
      }}
      title={title}
    >
      {children}
    </button>
  );
}

// SVG icons for toolbar — avoids font dependency
const Icons = {
  Bold: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.6 11.8c.9-.6 1.4-1.5 1.4-2.8 0-2.2-1.7-4-4-4H7v14h6.4c2.4 0 4.1-1.9 4.1-4.1 0-1.7-.9-3.1-2.5-3.5zM9 7h3.3c1 0 1.7.7 1.7 1.7S13.3 10.4 12.3 10.4H9V7zm3.8 10H9v-4h3.8c1.1 0 1.9.9 1.9 2s-.8 2-1.9 2z"/>
    </svg>
  ),
  Italic: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 5v3h2.2l-3.4 8H6v3h8v-3h-2.2l3.4-8H18V5h-8z"/>
    </svg>
  ),
  H1: () => <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px' }}>H1</span>,
  H2: () => <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px' }}>H2</span>,
  H3: () => <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px' }}>H3</span>,
  BulletList: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
    </svg>
  ),
  OrderedList: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-5v2h14V6H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
    </svg>
  ),
  Code: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </svg>
  ),
  CodeBlock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V5h16v14zM6 9.4L7.4 8l4 4-4 4L6 14.6 8.6 12 6 9.4zm5 6.6h6v-2h-6v2z"/>
    </svg>
  ),
  Undo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
    </svg>
  ),
  Redo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
    </svg>
  ),
};

export function DescriptionField({ task }) {
  const { syncTask, showToast } = useGitLabData();
  const { setDirty } = useSharedEditor();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldDirty, setFieldDirty] = useState(false);
  const lastSavedContentRef = useRef(task.details || '');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Add a description…' }),
    ],
    content: markdownToHtml(task.details || ''),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      const dirty = md !== lastSavedContentRef.current;
      setFieldDirty(dirty);
      setDirty(dirty);
    },
  });

  // Reset when task changes
  const taskIdRef = useRef(task.id);
  useEffect(() => {
    if (taskIdRef.current !== task.id) {
      taskIdRef.current = task.id;
      lastSavedContentRef.current = task.details || '';
      editor?.commands.setContent(markdownToHtml(task.details || ''));
      setFieldDirty(false);
      setDirty(false);
      setError(null);
    }
  }, [task.id, task.details, editor, setDirty]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);
    setSaving(true);
    setError(null);
    try {
      await syncTask(task.id, { details: markdown });
      lastSavedContentRef.current = markdown;
      setFieldDirty(false);
      setDirty(false);
    } catch (err) {
      setError('Failed to save description');
      showToast('Failed to save description', 'error');
    } finally {
      setSaving(false);
    }
  }, [editor, task.id, syncTask, showToast, setDirty]);

  const handleDiscard = useCallback(() => {
    editor?.commands.setContent(markdownToHtml(lastSavedContentRef.current));
    setFieldDirty(false);
    setDirty(false);
    setError(null);
  }, [editor, setDirty]);

  if (!editor) return null;

  return (
    <div className="shared-editor-field">
      <label className="shared-editor-field-label">Description</label>
      <div className="description-field-toolbar">
        <div className="desc-toolbar-group">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          ><Icons.Bold /></ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          ><Icons.Italic /></ToolbarButton>
        </div>
        <div className="desc-toolbar-separator" />
        <div className="desc-toolbar-group">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          ><Icons.H1 /></ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          ><Icons.H2 /></ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          ><Icons.H3 /></ToolbarButton>
        </div>
        <div className="desc-toolbar-separator" />
        <div className="desc-toolbar-group">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet list"
          ><Icons.BulletList /></ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered list"
          ><Icons.OrderedList /></ToolbarButton>
        </div>
        <div className="desc-toolbar-separator" />
        <div className="desc-toolbar-group">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline code"
          ><Icons.Code /></ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Code block"
          ><Icons.CodeBlock /></ToolbarButton>
        </div>
        <div className="desc-toolbar-separator" />
        <div className="desc-toolbar-group">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Icons.Undo /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Icons.Redo /></ToolbarButton>
        </div>
      </div>
      <EditorContent editor={editor} className="description-field-editor" />
      {fieldDirty && (
        <div className="description-field-footer">
          {error && <span className="description-field-error">{error}</span>}
          <button type="button" className="desc-discard-btn" onClick={handleDiscard} disabled={saving}>
            Discard
          </button>
          <button type="button" className="desc-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
