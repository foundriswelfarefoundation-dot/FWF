// Inject a shared header & footer on every page, manage active nav, mobile menu, and simple form hooks
(function(){
const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();


const header = `
<div class="topbar">
<div class="container">
<div class="row">
<div class="brand">
<img src="assets/images/logo.png" alt="FWF logo"/>
<div>
<div class="title">Foundris Welfare Foundation</div>
<div class="tag">Skill • Partnership • Prosperity</div>
</div>
</div>
<nav class="nav" id="nav">
<a class="nav-link" href="index.html" data-page="index.html">Home</a>
<a class="nav-link" href="about.html" data-page="about.html">About</a>
<a class="nav-link" href="programs.html" data-page="programs.html">Programs</a>
<a class="nav-link" href="projects.html" data-page="projects.html">Projects</a>
<a class="nav-link" href="join.html" data-page="join.html">Join</a>
<a class="nav-link" href="donate.html" data-page="donate.html">Donate</a>
<a class="nav-link" href="contact.html" data-page="contact.html">Contact</a>
</nav>
<button class="nav-toggle" id="nav-toggle">Menu</button>
</div>
</div>
</div>`;


const footer = `
<div class="footer">
<div class="container">
<div class="row">
<div>
<h5>About FWF</h5>
<p>FWF members ko skill training, cohort partnerships aur live outsource/CSR projects ke through sustainable income banane me madad karta hai.</p>
</div>
<div>
<h5>Quick Links</h5>
<p><a href="programs.html">Programs</a><br>
<a href="projects.html">Live Projects</a><br>
<a href="join.html">Membership</a><br>
<a href="donate.html">Donate</a></p>
</div>
<div>
<h5>Contact</h5>
<p><a href="mailto:info@fwfindia.org">info@fwfindia.org</a><br>
+91-9580118412<br>
1398/1850 Sagarpuri Gallamandi, Kanpur - 208021 U.P India</p>
</div>
</div>
<div class="bottom">
<div>© <span id="year"></span> Foundris Welfare Foundation • All rights reserved.</div>
<div>
<a href="#">Privacy</a> · <a href="#">Terms</a>
</div>
</div>
</div>
</div>`;


})();