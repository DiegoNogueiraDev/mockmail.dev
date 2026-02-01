// Smooth scroll para links de navegação
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Highlight do menu ativo baseado na seção visível
const sections = document.querySelectorAll('section');
const navItems = document.querySelectorAll('.nav-item a');

const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5
};

const observerCallback = (entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const activeId = entry.target.id;
            navItems.forEach(item => {
                if (item.getAttribute('href') === `#${activeId}`) {
                    item.style.background = 'var(--gradient-primary)';
                } else {
                    item.style.background = 'var(--gradient-dark)';
                }
            });
        }
    });
};

const observer = new IntersectionObserver(observerCallback, observerOptions);
sections.forEach(section => observer.observe(section));

// Animação de fade para os endpoints
const endpointElements = document.querySelectorAll('.endpoint');
const fadeOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const fadeCallback = (entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
};

const fadeObserver = new IntersectionObserver(fadeCallback, fadeOptions);
endpointElements.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    fadeObserver.observe(element);
});