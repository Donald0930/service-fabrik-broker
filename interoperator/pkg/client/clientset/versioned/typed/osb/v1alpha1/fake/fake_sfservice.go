/*
Copyright The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Code generated by client-gen. DO NOT EDIT.

package fake

import (
	v1alpha1 "github.com/cloudfoundry-incubator/service-fabrik-broker/interoperator/pkg/apis/osb/v1alpha1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	labels "k8s.io/apimachinery/pkg/labels"
	schema "k8s.io/apimachinery/pkg/runtime/schema"
	types "k8s.io/apimachinery/pkg/types"
	watch "k8s.io/apimachinery/pkg/watch"
	testing "k8s.io/client-go/testing"
)

// FakeSFServices implements SFServiceInterface
type FakeSFServices struct {
	Fake *FakeOsbV1alpha1
	ns   string
}

var sfservicesResource = schema.GroupVersionResource{Group: "osb.servicefabrik.io", Version: "v1alpha1", Resource: "sfservices"}

var sfservicesKind = schema.GroupVersionKind{Group: "osb.servicefabrik.io", Version: "v1alpha1", Kind: "SFService"}

// Get takes name of the sFService, and returns the corresponding sFService object, and an error if there is any.
func (c *FakeSFServices) Get(name string, options v1.GetOptions) (result *v1alpha1.SFService, err error) {
	obj, err := c.Fake.
		Invokes(testing.NewGetAction(sfservicesResource, c.ns, name), &v1alpha1.SFService{})

	if obj == nil {
		return nil, err
	}
	return obj.(*v1alpha1.SFService), err
}

// List takes label and field selectors, and returns the list of SFServices that match those selectors.
func (c *FakeSFServices) List(opts v1.ListOptions) (result *v1alpha1.SFServiceList, err error) {
	obj, err := c.Fake.
		Invokes(testing.NewListAction(sfservicesResource, sfservicesKind, c.ns, opts), &v1alpha1.SFServiceList{})

	if obj == nil {
		return nil, err
	}

	label, _, _ := testing.ExtractFromListOptions(opts)
	if label == nil {
		label = labels.Everything()
	}
	list := &v1alpha1.SFServiceList{ListMeta: obj.(*v1alpha1.SFServiceList).ListMeta}
	for _, item := range obj.(*v1alpha1.SFServiceList).Items {
		if label.Matches(labels.Set(item.Labels)) {
			list.Items = append(list.Items, item)
		}
	}
	return list, err
}

// Watch returns a watch.Interface that watches the requested sFServices.
func (c *FakeSFServices) Watch(opts v1.ListOptions) (watch.Interface, error) {
	return c.Fake.
		InvokesWatch(testing.NewWatchAction(sfservicesResource, c.ns, opts))

}

// Create takes the representation of a sFService and creates it.  Returns the server's representation of the sFService, and an error, if there is any.
func (c *FakeSFServices) Create(sFService *v1alpha1.SFService) (result *v1alpha1.SFService, err error) {
	obj, err := c.Fake.
		Invokes(testing.NewCreateAction(sfservicesResource, c.ns, sFService), &v1alpha1.SFService{})

	if obj == nil {
		return nil, err
	}
	return obj.(*v1alpha1.SFService), err
}

// Update takes the representation of a sFService and updates it. Returns the server's representation of the sFService, and an error, if there is any.
func (c *FakeSFServices) Update(sFService *v1alpha1.SFService) (result *v1alpha1.SFService, err error) {
	obj, err := c.Fake.
		Invokes(testing.NewUpdateAction(sfservicesResource, c.ns, sFService), &v1alpha1.SFService{})

	if obj == nil {
		return nil, err
	}
	return obj.(*v1alpha1.SFService), err
}

// UpdateStatus was generated because the type contains a Status member.
// Add a +genclient:noStatus comment above the type to avoid generating UpdateStatus().
func (c *FakeSFServices) UpdateStatus(sFService *v1alpha1.SFService) (*v1alpha1.SFService, error) {
	obj, err := c.Fake.
		Invokes(testing.NewUpdateSubresourceAction(sfservicesResource, "status", c.ns, sFService), &v1alpha1.SFService{})

	if obj == nil {
		return nil, err
	}
	return obj.(*v1alpha1.SFService), err
}

// Delete takes name of the sFService and deletes it. Returns an error if one occurs.
func (c *FakeSFServices) Delete(name string, options *v1.DeleteOptions) error {
	_, err := c.Fake.
		Invokes(testing.NewDeleteAction(sfservicesResource, c.ns, name), &v1alpha1.SFService{})

	return err
}

// DeleteCollection deletes a collection of objects.
func (c *FakeSFServices) DeleteCollection(options *v1.DeleteOptions, listOptions v1.ListOptions) error {
	action := testing.NewDeleteCollectionAction(sfservicesResource, c.ns, listOptions)

	_, err := c.Fake.Invokes(action, &v1alpha1.SFServiceList{})
	return err
}

// Patch applies the patch and returns the patched sFService.
func (c *FakeSFServices) Patch(name string, pt types.PatchType, data []byte, subresources ...string) (result *v1alpha1.SFService, err error) {
	obj, err := c.Fake.
		Invokes(testing.NewPatchSubresourceAction(sfservicesResource, c.ns, name, pt, data, subresources...), &v1alpha1.SFService{})

	if obj == nil {
		return nil, err
	}
	return obj.(*v1alpha1.SFService), err
}
