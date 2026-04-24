import uuid
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from app.ingest.chunker import chunk_text
from app.rag.vectorstore import VectorStore


async def ingest_url(
    url: str,
    vector_store: VectorStore,
    user_id: str = "default"
) -> tuple[str, int]:
    """
    Scrape and ingest content from a web URL.

    Args:
        url: Web URL to scrape
        vector_store: VectorStore instance
        user_id: User ID for data isolation

    Returns:
        tuple: (source_id, number_of_chunks)
    """
    source_id = str(uuid.uuid4())

    # Validate URL
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Invalid URL format")

    # Fetch the page
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        # Use different headers for Wikipedia vs other sites
        if 'wikipedia.org' in parsed.netloc.lower():
            headers = {
                "User-Agent": "NeuronBot/1.0 (Educational Research; contact@example.com)",
                "Accept": "text/html",
                "Accept-Language": "en-US,en;q=0.9",
            }
        else:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    # Parse HTML
    soup = BeautifulSoup(response.text, "html.parser")

    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()

    # Extract text from main content
    # Try to find main content area
    main_content = (
        soup.find("main") or
        soup.find("article") or
        soup.find(class_="content") or
        soup.find(class_="main") or
        soup.find("body")
    )

    if main_content:
        text = main_content.get_text(separator="\n", strip=True)
    else:
        text = soup.get_text(separator="\n", strip=True)

    # Clean up text
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    if not text or len(text) < 100:
        raise ValueError("Could not extract meaningful content from URL")

    # Get page title
    title = soup.title.string if soup.title else parsed.netloc
    source_name = f"{title} ({parsed.netloc})"

    # Chunk the text
    chunks = chunk_text(text)

    for chunk in chunks:
        chunk["metadata"]["source_id"] = source_id
        chunk["metadata"]["source_name"] = source_name
        chunk["metadata"]["source_type"] = "web"
        chunk["metadata"]["url"] = url

    # Add to vector store
    await vector_store.add_documents(chunks, source_id, source_name, "web", user_id)

    return source_id, len(chunks)
