/**
 * DescriptionMetadataUtils Tests
 * Comprehensive tests for description metadata utility functions:
 * - extractLinksFromDescription: parsing metadata blocks from descriptions
 * - updateDescriptionWithLinks: writing metadata blocks into descriptions
 * - removeLinksFromDescription: cleaning metadata from descriptions
 * - addBlocksRelation / addBlockedByRelation: adding link relationships
 * - removeBlocksRelation / removeBlockedByRelation: removing link relationships
 * - hasAnyLinks: checking if links exist
 * - mergeLinks: combining two link metadata objects
 */

import { describe, it, expect, vi } from 'vitest';
import {
  extractLinksFromDescription,
  updateDescriptionWithLinks,
  removeLinksFromDescription,
  addBlocksRelation,
  addBlockedByRelation,
  removeBlocksRelation,
  removeBlockedByRelation,
  hasAnyLinks,
  mergeLinks,
} from '../DescriptionMetadataUtils';
import type { DescriptionLinkMetadata } from '../DescriptionMetadataUtils';

// ============================================================================
// Helper to build a valid metadata block string
// ============================================================================

function buildMetadataBlock(links: DescriptionLinkMetadata): string {
  const metadata = {
    version: 1,
    gantt: { links },
  };
  return `<!-- GANTT_METADATA_START\n${JSON.stringify(metadata, null, 2)}\nGANTT_METADATA_END -->`;
}

// ============================================================================
// extractLinksFromDescription
// ============================================================================

describe('extractLinksFromDescription', () => {
  it('should return empty links for null input', () => {
    const result = extractLinksFromDescription(null);
    expect(result.links).toEqual({});
    expect(result.hasMetadata).toBe(false);
  });

  it('should return empty links for undefined input', () => {
    const result = extractLinksFromDescription(undefined);
    expect(result.links).toEqual({});
    expect(result.hasMetadata).toBe(false);
  });

  it('should return empty links for empty string', () => {
    const result = extractLinksFromDescription('');
    expect(result.links).toEqual({});
    expect(result.hasMetadata).toBe(false);
  });

  it('should return empty links for whitespace-only string', () => {
    const result = extractLinksFromDescription('   \n  \t  ');
    expect(result.links).toEqual({});
    expect(result.hasMetadata).toBe(false);
  });

  it('should return empty links when no metadata block exists', () => {
    const result = extractLinksFromDescription(
      'This is a normal description without metadata.',
    );
    expect(result.links).toEqual({});
    expect(result.hasMetadata).toBe(false);
  });

  it('should extract valid blocks and blocked_by arrays', () => {
    const description =
      'Some description\n\n' +
      buildMetadataBlock({ blocks: [10, 20], blocked_by: [5] });

    const result = extractLinksFromDescription(description);
    expect(result.hasMetadata).toBe(true);
    expect(result.links.blocks).toEqual([10, 20]);
    expect(result.links.blocked_by).toEqual([5]);
  });

  it('should sort extracted link IDs', () => {
    const description = buildMetadataBlock({
      blocks: [30, 10, 20],
      blocked_by: [50, 5, 25],
    });

    const result = extractLinksFromDescription(description);
    expect(result.links.blocks).toEqual([10, 20, 30]);
    expect(result.links.blocked_by).toEqual([5, 25, 50]);
  });

  it('should handle metadata with only blocks', () => {
    const description = buildMetadataBlock({ blocks: [1, 2, 3] });

    const result = extractLinksFromDescription(description);
    expect(result.hasMetadata).toBe(true);
    expect(result.links.blocks).toEqual([1, 2, 3]);
    expect(result.links.blocked_by).toBeUndefined();
  });

  it('should handle metadata with only blocked_by', () => {
    const description = buildMetadataBlock({ blocked_by: [7, 8] });

    const result = extractLinksFromDescription(description);
    expect(result.hasMetadata).toBe(true);
    expect(result.links.blocks).toBeUndefined();
    expect(result.links.blocked_by).toEqual([7, 8]);
  });

  it('should return empty links for malformed JSON', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const description =
      '<!-- GANTT_METADATA_START\n{not valid json}\nGANTT_METADATA_END -->';

    const result = extractLinksFromDescription(description);
    expect(result.hasMetadata).toBe(true);
    expect(result.links).toEqual({});
    warnSpy.mockRestore();
  });

  it('should return empty links when start marker exists but end marker is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const description =
      '<!-- GANTT_METADATA_START\n{"version": 1, "gantt": {"links": {"blocks": [1]}}}';

    const result = extractLinksFromDescription(description);
    expect(result.hasMetadata).toBe(false);
    expect(result.links).toEqual({});
    warnSpy.mockRestore();
  });

  it('should filter out invalid (non-integer, negative, zero) IDs', () => {
    const description =
      '<!-- GANTT_METADATA_START\n' +
      JSON.stringify({
        version: 1,
        gantt: {
          links: {
            blocks: [1, -2, 0, 3.5, 'abc', 4, null],
            blocked_by: [10, -1, 0, 20],
          },
        },
      }) +
      '\nGANTT_METADATA_END -->';

    const result = extractLinksFromDescription(description);
    expect(result.links.blocks).toEqual([1, 4]);
    expect(result.links.blocked_by).toEqual([10, 20]);
  });

  it('should include rawMetadata in result when valid', () => {
    const description = buildMetadataBlock({ blocks: [1] });

    const result = extractLinksFromDescription(description);
    expect(result.rawMetadata).toBeDefined();
    expect(result.rawMetadata!.version).toBe(1);
    expect(result.rawMetadata!.gantt!.links!.blocks).toEqual([1]);
  });

  it('should handle empty metadata block', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const description =
      '<!-- GANTT_METADATA_START\n\nGANTT_METADATA_END -->';

    const result = extractLinksFromDescription(description);
    expect(result.hasMetadata).toBe(true);
    expect(result.links).toEqual({});
    warnSpy.mockRestore();
  });

  it('should handle metadata with unknown version (forward compatibility)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const description =
      '<!-- GANTT_METADATA_START\n' +
      JSON.stringify({
        version: 99,
        gantt: { links: { blocks: [1, 2] } },
      }) +
      '\nGANTT_METADATA_END -->';

    const result = extractLinksFromDescription(description);
    // Should still extract links even with unknown version
    expect(result.links.blocks).toEqual([1, 2]);
    warnSpy.mockRestore();
  });
});

// ============================================================================
// updateDescriptionWithLinks
// ============================================================================

describe('updateDescriptionWithLinks', () => {
  it('should add metadata to empty/null description', () => {
    const result = updateDescriptionWithLinks(null, { blocks: [1, 2] });
    expect(result).toContain('<!-- GANTT_METADATA_START');
    expect(result).toContain('GANTT_METADATA_END -->');
    expect(result).toContain('"blocks"');
  });

  it('should append metadata to existing description', () => {
    const result = updateDescriptionWithLinks('My description', {
      blocks: [5],
    });
    expect(result).toContain('My description');
    expect(result).toContain('<!-- GANTT_METADATA_START');
    expect(result).toContain('"blocks"');
  });

  it('should replace existing metadata block', () => {
    const original =
      'Description text\n\n' +
      buildMetadataBlock({ blocks: [1] });

    const result = updateDescriptionWithLinks(original, {
      blocks: [10, 20],
    });

    // Should contain updated links
    expect(result).toContain('"blocks"');
    // Should only have one metadata block
    const startCount = (
      result.match(/<!-- GANTT_METADATA_START/g) || []
    ).length;
    expect(startCount).toBe(1);

    // Verify the new links are present
    const extracted = extractLinksFromDescription(result);
    expect(extracted.links.blocks).toEqual([10, 20]);
  });

  it('should remove metadata block when links are empty', () => {
    const original =
      'Description text\n\n' +
      buildMetadataBlock({ blocks: [1, 2] });

    const result = updateDescriptionWithLinks(original, {});
    expect(result).not.toContain('GANTT_METADATA_START');
    expect(result).toContain('Description text');
  });

  it('should remove metadata block when blocks and blocked_by are empty arrays', () => {
    const original = 'Some text\n\n' + buildMetadataBlock({ blocks: [1] });

    const result = updateDescriptionWithLinks(original, {
      blocks: [],
      blocked_by: [],
    });
    expect(result).not.toContain('GANTT_METADATA_START');
    expect(result.trim()).toBe('Some text');
  });

  it('should sort link IDs in the output', () => {
    const result = updateDescriptionWithLinks(null, {
      blocks: [30, 10, 20],
      blocked_by: [50, 5],
    });

    const extracted = extractLinksFromDescription(result);
    expect(extracted.links.blocks).toEqual([10, 20, 30]);
    expect(extracted.links.blocked_by).toEqual([5, 50]);
  });

  it('should handle description ending with newlines', () => {
    const result = updateDescriptionWithLinks('Text\n\n', {
      blocks: [1],
    });
    // Should not have excessive newlines between text and metadata
    expect(result).not.toMatch(/\n{4,}/);
    expect(result).toContain('Text');
    expect(result).toContain('GANTT_METADATA_START');
  });
});

// ============================================================================
// removeLinksFromDescription
// ============================================================================

describe('removeLinksFromDescription', () => {
  it('should return empty string for null input', () => {
    expect(removeLinksFromDescription(null)).toBe('');
  });

  it('should return description unchanged when no metadata present', () => {
    expect(removeLinksFromDescription('Hello world')).toBe('Hello world');
  });

  it('should remove metadata block and preserve description', () => {
    const original =
      'My content\n\n' + buildMetadataBlock({ blocks: [1, 2] });

    const result = removeLinksFromDescription(original);
    expect(result).toBe('My content');
    expect(result).not.toContain('GANTT_METADATA_START');
  });
});

// ============================================================================
// addBlocksRelation
// ============================================================================

describe('addBlocksRelation', () => {
  it('should add a blocks relation to empty links', () => {
    const result = addBlocksRelation({}, 5);
    expect(result.blocks).toEqual([5]);
  });

  it('should add to existing blocks array', () => {
    const result = addBlocksRelation({ blocks: [1, 3] }, 2);
    expect(result.blocks).toEqual([1, 2, 3]);
  });

  it('should not duplicate existing IDs', () => {
    const result = addBlocksRelation({ blocks: [1, 2, 3] }, 2);
    expect(result.blocks).toEqual([1, 2, 3]);
  });

  it('should preserve blocked_by when adding blocks', () => {
    const result = addBlocksRelation(
      { blocks: [1], blocked_by: [10] },
      2,
    );
    expect(result.blocks).toEqual([1, 2]);
    expect(result.blocked_by).toEqual([10]);
  });
});

// ============================================================================
// addBlockedByRelation
// ============================================================================

describe('addBlockedByRelation', () => {
  it('should add a blocked_by relation to empty links', () => {
    const result = addBlockedByRelation({}, 7);
    expect(result.blocked_by).toEqual([7]);
  });

  it('should add to existing blocked_by array', () => {
    const result = addBlockedByRelation({ blocked_by: [5, 10] }, 7);
    expect(result.blocked_by).toEqual([5, 7, 10]);
  });

  it('should not duplicate existing IDs', () => {
    const result = addBlockedByRelation({ blocked_by: [5, 10] }, 5);
    expect(result.blocked_by).toEqual([5, 10]);
  });

  it('should preserve blocks when adding blocked_by', () => {
    const result = addBlockedByRelation(
      { blocks: [1], blocked_by: [5] },
      10,
    );
    expect(result.blocks).toEqual([1]);
    expect(result.blocked_by).toEqual([5, 10]);
  });
});

// ============================================================================
// removeBlocksRelation
// ============================================================================

describe('removeBlocksRelation', () => {
  it('should remove a specific blocks relation', () => {
    const result = removeBlocksRelation({ blocks: [1, 2, 3] }, 2);
    expect(result.blocks).toEqual([1, 3]);
  });

  it('should set blocks to undefined when last item removed', () => {
    const result = removeBlocksRelation({ blocks: [5] }, 5);
    expect(result.blocks).toBeUndefined();
  });

  it('should handle removing non-existent ID gracefully', () => {
    const result = removeBlocksRelation({ blocks: [1, 2] }, 99);
    expect(result.blocks).toEqual([1, 2]);
  });

  it('should handle empty blocks array', () => {
    const result = removeBlocksRelation({}, 5);
    expect(result.blocks).toBeUndefined();
  });
});

// ============================================================================
// removeBlockedByRelation
// ============================================================================

describe('removeBlockedByRelation', () => {
  it('should remove a specific blocked_by relation', () => {
    const result = removeBlockedByRelation({ blocked_by: [5, 10, 15] }, 10);
    expect(result.blocked_by).toEqual([5, 15]);
  });

  it('should set blocked_by to undefined when last item removed', () => {
    const result = removeBlockedByRelation({ blocked_by: [7] }, 7);
    expect(result.blocked_by).toBeUndefined();
  });

  it('should handle removing non-existent ID gracefully', () => {
    const result = removeBlockedByRelation({ blocked_by: [1] }, 99);
    expect(result.blocked_by).toEqual([1]);
  });
});

// ============================================================================
// hasAnyLinks
// ============================================================================

describe('hasAnyLinks', () => {
  it('should return false for empty links object', () => {
    expect(hasAnyLinks({})).toBe(false);
  });

  it('should return false for undefined arrays', () => {
    expect(hasAnyLinks({ blocks: undefined, blocked_by: undefined })).toBe(
      false,
    );
  });

  it('should return true when blocks has items', () => {
    expect(hasAnyLinks({ blocks: [1] })).toBe(true);
  });

  it('should return true when blocked_by has items', () => {
    expect(hasAnyLinks({ blocked_by: [1] })).toBe(true);
  });

  it('should return true when both have items', () => {
    expect(hasAnyLinks({ blocks: [1], blocked_by: [2] })).toBe(true);
  });
});

// ============================================================================
// mergeLinks
// ============================================================================

describe('mergeLinks', () => {
  it('should merge two empty link objects', () => {
    const result = mergeLinks({}, {});
    expect(result.blocks).toBeUndefined();
    expect(result.blocked_by).toBeUndefined();
  });

  it('should merge when first has links and second is empty', () => {
    const result = mergeLinks({ blocks: [1, 2] }, {});
    expect(result.blocks).toEqual([1, 2]);
  });

  it('should merge when second has links and first is empty', () => {
    const result = mergeLinks({}, { blocked_by: [5, 10] });
    expect(result.blocked_by).toEqual([5, 10]);
  });

  it('should produce union of blocks from both sources', () => {
    const result = mergeLinks(
      { blocks: [1, 3] },
      { blocks: [2, 3, 4] },
    );
    expect(result.blocks).toEqual([1, 2, 3, 4]);
  });

  it('should produce union of blocked_by from both sources', () => {
    const result = mergeLinks(
      { blocked_by: [10, 20] },
      { blocked_by: [20, 30] },
    );
    expect(result.blocked_by).toEqual([10, 20, 30]);
  });

  it('should deduplicate IDs across sources', () => {
    const result = mergeLinks(
      { blocks: [1, 2, 3], blocked_by: [10] },
      { blocks: [2, 3, 4], blocked_by: [10, 20] },
    );
    expect(result.blocks).toEqual([1, 2, 3, 4]);
    expect(result.blocked_by).toEqual([10, 20]);
  });

  it('should return sorted results', () => {
    const result = mergeLinks(
      { blocks: [30, 10] },
      { blocks: [20, 5] },
    );
    expect(result.blocks).toEqual([5, 10, 20, 30]);
  });
});
