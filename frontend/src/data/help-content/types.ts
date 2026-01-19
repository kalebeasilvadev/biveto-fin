export interface HelpSection {
  title: string
  content: string
  icon?: string
}

export interface HelpContent {
  pageId: string
  pageTitle: string
  description: string
  sections: HelpSection[]
  tips?: string[]
  relatedPages?: { title: string; path: string }[]
}
