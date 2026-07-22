mapboxgl.accessToken = map_token;
const map = new mapboxgl.Map({
    container: 'map', // container ID
    center: listing.geometry.coordinates, // starting position [lng, lat]. Note that lat must be set between -90 and 90
    zoom:11 // starting zoom
});

const marker1 = new mapboxgl.Marker({color:"red"})
.setLngLat(listing.geometry.coordinates)
.setPopup(new mapboxgl.Popup({offset: 25})
.setHTML(`<h2>${listing.location}</h2>
           <p>Exact location provided after booking<p>`))
.addTo(map);
